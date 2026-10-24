/**
 * @fileoverview Centralized Firebase Cloud Functions for the CrediHub platform.
 * This file defines the backend logic for secure operations such as user management,
 * invite code handling, and activation.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Initialize the Firebase Admin SDK once at the root level.
admin.initializeApp();

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

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
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