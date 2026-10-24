
/**
 * @fileoverview Centralized Firebase Cloud Functions for the SAILE platform.
 * This file defines the backend logic for secure operations such as user management
 * and institutional access requests.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Initialize the Firebase Admin SDK.
admin.initializeApp();


/**
 * Checks if the calling user has administrative privileges via a decoded ID token.
 * Throws an HttpsError if the user is not an admin.
 * @param {admin.auth.DecodedIdToken | undefined} decodedToken - The decoded ID token from the request.
 */
const ensureAdminFromToken = (decodedToken: admin.auth.DecodedIdToken | undefined) => {
    if (!decodedToken || decodedToken.role !== 'admin') {
        throw new HttpsError("permission-denied", "Unauthorized. Caller must be a platform admin.");
    }
};


/**
 * @summary Creates a new user, sets their claims, and creates their Firestore profile.
 * @description Can be called by an admin to create any type of user.
 * @param {object} data - User creation payload.
 * @returns {Promise<{ uid: string, message: string }>} A success response with the new user's UID.
 * @throws {HttpsError} Throws an error if the caller is not an admin or if the payload is invalid.
 */
export const createUser = onCall({ region: "us-central1" }, async (request) => {
    ensureAdminFromToken(request.auth?.token);

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
        const userDocRef = admin.firestore().collection('users').doc(userRecord.uid);
        await userDocRef.set({
            uid: userRecord.uid,
            email,
            firstName,
            lastName,
            name: `${firstName} ${lastName}`,
            role: role,
            institutionId: institutionId || null,
            branchIds: Array.isArray(branchIds) && branchIds.length > 0 ? branchIds : ['01'],
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


/**
 * @summary Updates an existing user's claims and Firestore profile.
 * @description A callable function that can be called by an admin to update any user.
 */
export const updateUser = onCall({ region: "us-central1" }, async (request) => {
  ensureAdminFromToken(request.auth?.token);

  const {
    uid,
    firstName,
    lastName,
    role,
    institutionId,
    branchIds,
    customRoleId,
    customRoleName,
    status,
    appraisalLimit,
    employeeId,
  } = request.data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "Missing uid.");
  }

  try {
    // Update Auth claims
    const claims = {
      role,
      ...(institutionId && { institutionId }),
    };
    await admin.auth().setCustomUserClaims(uid, claims);

    // Update Auth profile
    if (firstName && lastName) {
      await admin.auth().updateUser(uid, {
        displayName: `${firstName} ${lastName}`,
      });
    }

    // Update Firestore profile
    const userDocRef = admin.firestore().collection("users").doc(uid);
    await userDocRef.update({
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      role,
      institutionId: institutionId || null,
      branchIds: branchIds || [],
      customRoleId: customRoleId || null,
      customRoleName: customRoleName || null,
      status: status || "Active",
      appraisalLimit: appraisalLimit || 0,
      employeeId: employeeId || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { uid, message: "User updated successfully." };
  } catch (error: any) {
    logger.error("Error updating user:", error);
    throw new HttpsError("internal", error.message);
  }
});
