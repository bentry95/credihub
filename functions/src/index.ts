/**
 * @fileoverview Centralized Firebase Cloud Functions for the CrediHub platform.
 * This file defines the backend logic for secure operations such as user management,
 * invite code handling, and activation.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import nodemailer from "nodemailer";
import { randomBytes } from "node:crypto";

// Initialize the Firebase Admin SDK once at the root level.
admin.initializeApp();

const smtpHost = defineSecret('SMTP_HOST');
const smtpPort = defineSecret('SMTP_PORT');
const smtpUser = defineSecret('SMTP_USER');
const smtpPassword = defineSecret('SMTP_PASSWORD');
const smtpFrom = defineSecret('SMTP_FROM');

function createMailer() {
    const port = Number(smtpPort.value() || 587);
    return nodemailer.createTransport({
        host: smtpHost.value(),
        port,
        secure: port === 465,
        auth: { user: smtpUser.value(), pass: smtpPassword.value() },
    });
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character] || character);
}

/** Delivers a customer notification when a loan moves to a different stage. */
export const notifyCustomerLoanStage = onDocumentUpdated({
    document: 'institutions/{institutionId}/loanApplications/{loanId}',
    secrets: [smtpHost, smtpPort, smtpUser, smtpPassword, smtpFrom],
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status || !after.customerId) return;

    const institutionId = event.params.institutionId;
    const customerSnap = await admin.firestore().doc(`institutions/${institutionId}/customers/${after.customerId}`).get();
    const email = customerSnap.data()?.email;
    if (!email) {
        logger.info('Loan stage email skipped: customer has no email address.', { institutionId, loanId: event.params.loanId });
        return;
    }
    const institutionSnap = await admin.firestore().doc(`institutions/${institutionId}`).get();
    const institutionName = institutionSnap.data()?.name || 'CrediHub';
    const customerName = customerSnap.data()?.name || 'Customer';
    const loanId = event.params.loanId;
    await createMailer().sendMail({
        from: smtpFrom.value(),
        to: email,
        subject: `Loan application update: ${after.status}`,
        text: `Hello ${customerName}, your loan application ${loanId} has moved from ${before.status} to ${after.status}. Contact ${institutionName} if you need assistance.`,
        html: `<p>Hello ${escapeHtml(customerName)},</p><p>Your loan application <strong>${escapeHtml(loanId)}</strong> has moved from <strong>${escapeHtml(String(before.status || 'Unknown'))}</strong> to <strong>${escapeHtml(String(after.status || 'Unknown'))}</strong>.</p><p>Contact ${escapeHtml(institutionName)} if you need assistance.</p>`,
    });
});

/** Sends a staff invitation after confirming the caller and institution ownership. */
export const sendStaffInvitationEmail = onCall({
    region: 'us-central1',
    secrets: [smtpHost, smtpPort, smtpUser, smtpPassword, smtpFrom],
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to send an invitation.');
    const { email, code, institutionId } = request.data || {};
    if (typeof email !== 'string' || typeof code !== 'string' || typeof institutionId !== 'string') {
        throw new HttpsError('invalid-argument', 'Email, invitation code, and institution are required.');
    }
    const caller = await admin.firestore().doc(`users/${request.auth.uid}`).get();
    const callerData = caller.data();
    if (!callerData || !['admin', 'institution-admin'].includes(callerData.role) ||
        (callerData.role !== 'admin' && callerData.institutionId !== institutionId)) {
        throw new HttpsError('permission-denied', 'Only an institution administrator can send staff invitations.');
    }
    const institution = await admin.firestore().doc(`institutions/${institutionId}`).get();
    const name = institution.data()?.name || 'your institution';
    await createMailer().sendMail({
        from: smtpFrom.value(),
        to: email,
        subject: `Invitation to join ${name}`,
        text: `You have been invited to join ${name} on CrediHub. Use invitation code ${code} to sign up.`,
        html: `<p>You have been invited to join ${escapeHtml(name)} on CrediHub.</p><p>Use this invitation code to sign up: <strong>${escapeHtml(code)}</strong></p>`,
    });
    return { success: true };
});

/**
 * Checks if the caller has specific role privileges via their decoded token.
 */
const ensureRole = (auth: any, allowedRoles: string[]) => {
    if (!auth || !auth.token || !auth.token.role || !allowedRoles.includes(auth.token.role)) {
        throw new HttpsError("permission-denied", "Unauthorized access. Insufficient permissions.");
    }
};

/**
 * Generates a unique invitation code for an institution.
 */
export const generateInviteCode = onCall({ region: "us-central1", cors: true }, async (request) => {
    ensureRole(request.auth, ['admin', 'institution-admin']);
    
    const institutionId = request.auth!.token.institutionId;
    if (!institutionId) throw new HttpsError("failed-precondition", "Missing institution context.");

    const code = randomBytes(4).toString('hex').toUpperCase();
    // Use a unique ID for the document, but the code itself is what the user enters.
    const codeId = admin.firestore().collection('temp').doc().id;

    const codeData = {
        id: codeId,
        code,
        institutionId,
        status: 'Active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: request.auth!.uid,
    };

    await admin.firestore()
        .collection('institutions').doc(institutionId)
        .collection('invitationCodes').doc(codeId)
        .set(codeData);

    return { code };
});

/**
 * Validates an invite code and returns basic institution info for the signup screen.
 */
export const validateInviteCode = onCall({ region: "us-central1", cors: true }, async (request) => {
    const { code } = request.data;
    if (!code) throw new HttpsError("invalid-argument", "Code is required.");

    const snapshot = await admin.firestore()
        .collectionGroup('invitationCodes')
        .where('code', '==', code.toUpperCase())
        .where('status', '==', 'Active')
        .limit(1)
        .get();

    if (snapshot.empty) {
        throw new HttpsError("not-found", "Invalid or expired invitation code.");
    }

    const codeDoc = snapshot.docs[0].data();
    const instDoc = await admin.firestore().collection('institutions').doc(codeDoc.institutionId).get();
    
    return { 
        institutionId: codeDoc.institutionId,
        institutionName: instDoc.data()?.name || 'Unknown Institution'
    };
});

/**
 * Handles user signup using an invitation code.
 */
export const signupWithInviteCode = onCall({ region: "us-central1", cors: true }, async (request) => {
    const { code, email, password, firstName, lastName } = request.data;

    if (!code || !email || !password || !firstName || !lastName) {
        throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    const snapshot = await admin.firestore()
        .collectionGroup('invitationCodes')
        .where('code', '==', code.toUpperCase())
        .where('status', '==', 'Active')
        .limit(1)
        .get();

    if (snapshot.empty) {
        throw new HttpsError("not-found", "Invalid invitation code.");
    }

    const codeDoc = snapshot.docs[0];
    const { institutionId } = codeDoc.data();

    const institutionSnapshot = await admin.firestore().collection('institutions').doc(institutionId).get();
    const policy = institutionSnapshot.data()?.securitySettings || {};
    const minimumLength = Math.max(8, Number(policy.passwordMinLength) || 8);
    if (password.length < minimumLength ||
        (policy.requireUppercase && !/[A-Z]/.test(password)) ||
        (policy.requireNumber && !/[0-9]/.test(password)) ||
        (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password))) {
        throw new HttpsError('invalid-argument', 'Password does not meet this institution’s security requirements.');
    }

    try {
        // 1. Create Auth User
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: `${firstName} ${lastName}`,
        });

        // 2. Mark code as used
        await codeDoc.ref.update({ status: 'Used' });

        // 3. Create User profile with Pending status
        await admin.firestore().collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email,
            firstName,
            lastName,
            name: `${firstName} ${lastName}`,
            institutionId,
            status: 'Pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true };
    } catch (error: any) {
        logger.error('Signup error:', error);
        if (error.code === 'auth/email-already-exists') {
            throw new HttpsError("already-exists", "An account with this email already exists.");
        }
        throw new HttpsError("internal", error.message);
    }
});

/**
 * Activates a pending user, assigns role/branches, and sets claims.
 */
export const activateUser = onCall({ region: "us-central1", cors: true }, async (request) => {
    ensureRole(request.auth, ['admin', 'institution-admin']);
    
    const { uid, role, branchIds, appraisalLimit, employeeId, customRoleId, customRoleName } = request.data;
    const callerInstitutionId = request.auth!.token.institutionId;

    if (!uid || !role || !branchIds) throw new HttpsError("invalid-argument", "Missing activation details.");

    const userDocRef = admin.firestore().collection('users').doc(uid);
    const userSnap = await userDocRef.get();
    
    if (!userSnap.exists) throw new HttpsError("not-found", "User not found.");
    const userData = userSnap.data();

    // Context Safety Check
    if (userData?.institutionId !== callerInstitutionId && request.auth!.token.role !== 'admin') {
        throw new HttpsError("permission-denied", "Unauthorized to activate user from another institution.");
    }

    try {
        let employeeNumber = null;
        const targetInstitutionId = userData?.institutionId; // Fixed reference error by capturing the target ID safely

        if (targetInstitutionId) {
            const instRef = admin.firestore().collection('institutions').doc(targetInstitutionId);
            await admin.firestore().runTransaction(async (transaction) => {
                const instSnap = await transaction.get(instRef);
                const currentCounter = instSnap.data()?.employeeCounter || 0;
                employeeNumber = currentCounter + 1;
                transaction.update(instRef, { employeeCounter: employeeNumber });
            });
        }

        // Set custom claims
        await admin.auth().setCustomUserClaims(uid, {
            role,
            institutionId: targetInstitutionId || null,
        });

        // Update profile
        await userDocRef.update({
            status: 'Active',
            role,
            branchIds,
            appraisalLimit: appraisalLimit || 0,
            employeeId: employeeId || null,
            employeeNumber,
            customRoleId: customRoleId || null,
            customRoleName: customRoleName || null,
            activatedAt: admin.firestore.FieldValue.serverTimestamp(),
            activatedBy: request.auth!.uid,
        });

        return { success: true };
    } catch (error: any) {
        logger.error('Activation error:', error);
        throw new HttpsError("internal", error.message);
    }
});

/**
 * Legacy/Platform-level user creation (for Platform Admins).
 */
export const createUser = onCall({ region: "us-central1", cors: true }, async (request) => {
    ensureRole(request.auth, ['admin']);

    const { email, password, firstName, lastName, role, institutionId } = request.data;

    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: `${firstName} ${lastName}`,
        });

        await admin.auth().setCustomUserClaims(userRecord.uid, {
            role,
            institutionId: institutionId || null,
        });

        await admin.firestore().collection('users').doc(userRecord.uid).set({
            uid: userRecord.uid,
            email,
            firstName,
            lastName,
            name: `${firstName} ${lastName}`,
            role,
            institutionId: institutionId || null,
            status: 'Active',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { uid: userRecord.uid };
    } catch (error: any) {
        logger.error('Create user error:', error);
        throw new HttpsError("internal", error.message);
    }
});

/**
 * Updates any user's profile and claims (Platform Admin only).
 */
export const updateUser = onCall({ region: "us-central1", cors: true }, async (request) => {
    ensureRole(request.auth, ['admin']);
    const { uid, role, institutionId, ...profileData } = request.data;

    try {
        await admin.auth().setCustomUserClaims(uid, { role, institutionId });
        await admin.firestore().collection('users').doc(uid).update({
            ...profileData,
            role,
            institutionId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true };
    } catch (error: any) {
        logger.error('Update user error:', error);
        throw new HttpsError("internal", error.message);
    }
});
