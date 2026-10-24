
/**
 * @fileoverview Centralized Firebase Cloud Functions for the CrediHub platform.
 * This file defines the backend logic for secure operations such as user management
 * and institutional access requests.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Initialize the Firebase Admin SDK.
admin.initializeApp();

/**
 * Checks if the calling user has administrative privileges.
 * Throws an HttpsError if the user is not authenticated or not an admin.
 * @param {any} auth - The authentication context from the callable function request.
 */
const ensureAdmin = (auth: any) => {
    if (!auth || !auth.token.role || auth.token.role !== 'admin') {
        throw new HttpsError("permission-denied", "Unauthorized. Caller must be a platform admin.");
    }
};

/**
 * @summary Handles a new user's request to join an institution.
 * @description Creates a user in Firebase Auth and adds a corresponding document to the `pendingUsers` collection for admin approval.
 * @param {object} data - The user's signup information (email, password, firstName, lastName).
 * @returns {Promise<{ success: boolean, message: string }>} A success response.
 * @throws {HttpsError} Throws an error if the user already exists or if the request is invalid.
 */
export const requestInstitutionalAccess = onCall({ region: "us-central1", allowInsecure: true }, async (request) => {
    const { email, password, firstName, lastName } = request.data;
    if (!email || !password || !firstName || !lastName) {
        throw new HttpsError("invalid-argument", "Missing required fields: email, password, firstName, lastName.");
    }
     if (password.length < 6) {
        throw new HttpsError("invalid-argument", "Password must be at least 6 characters.");
    }

    try {
        const existingUser = await admin.auth().getUserByEmail(email).catch(() => null);
        if (existingUser) {
            throw new HttpsError("already-exists", "A user with this email address already exists.");
        }

        const pendingSnapshot = await admin.firestore().collection('pendingUsers').where('email', '==', email).limit(1).get();
        if (!pendingSnapshot.empty) {
            throw new HttpsError("already-exists", "An access request for this email is already pending.");
        }

        // We only create the pending document, not the auth user, to prevent orphaned accounts.
        // The admin will create the full auth user upon approval.
        const newPendingUserRef = admin.firestore().collection('pendingUsers').doc();
        
        await newPendingUserRef.set({
            id: newPendingUserRef.id,
            email,
            password, // Storing password temporarily. Ensure Firestore rules protect this.
            name: `${firstName} ${lastName}`.trim(),
            firstName,
            lastName,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, message: 'Request submitted successfully.' };
    } catch (error: any) {
        logger.error("Error in requestInstitutionalAccess:", error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError("internal", "An unexpected error occurred while processing your request.");
    }
});


/**
 * @summary Creates a new user, sets their claims, and creates their Firestore profile.
 * @description Can be called by an admin to create any type of user.
 * @param {object} data - User creation payload.
 * @returns {Promise<{ uid: string, message: string }>} A success response with the new user's UID.
 * @throws {HttpsError} Throws an error if the caller is not an admin or if the payload is invalid.
 */
export const createUser = onCall({ region: "us-central1" }, async (request) => {
    ensureAdmin(request.auth);

    const {
        email,
        password,
        firstName,
        lastName,
        role, // 'admin', 'institution-admin', or 'staff'
        institutionId,
        branchIds,
        customRoleId,
        customRoleName,
        status,
        appraisalLimit,
        employeeId,
    } = request.data;

    if (!email || !password || !firstName || !lastName || !role) {
        throw new HttpsError('invalid-argument', 'Missing required fields.');
    }

    try {
        // 1. Create user in Firebase Auth
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: `${firstName} ${lastName}`,
        });

        // 2. Set custom claims
        const claims = {
            role: role,
            ...(institutionId && { institutionId: institutionId }),
        };
        await admin.auth().setCustomUserClaims(userRecord.uid, claims);

        // 3. Create user document in Firestore
        const userDocRef = doc(firestore, 'users', userRecord.uid);
        await userDocRef.set({
            uid: userRecord.uid,
            email,
            firstName,
            lastName,
            name: `${firstName} ${lastName}`,
            role: role,
            institutionId: institutionId || null,
            branchIds: branchIds || [],
            customRoleId: customRoleId || null,
            customRoleName: customRoleName || null,
            status: status || 'Active',
            appraisalLimit: appraisalLimit || 0,
            employeeId: employeeId || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        // If this creation is from a pending request, delete the pending doc.
        const pendingSnapshot = await admin.firestore().collection('pendingUsers').where('email', '==', email).limit(1).get();
        if (!pendingSnapshot.empty) {
            await pendingSnapshot.docs[0].ref.delete();
        }

        return { uid: userRecord.uid, message: 'User created successfully.' };
    } catch (error: any) {
        logger.error('Error creating user:', error);
         if (error.code === 'auth/email-already-exists') {
            throw new HttpsError('already-exists', 'A user with this email already exists.');
        }
        throw new HttpsError('internal', error.message);
    }
});
