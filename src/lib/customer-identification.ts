import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';

export function normalizeNationalId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function nationalIdIndexKey(value: unknown): string {
  return encodeURIComponent(normalizeNationalId(value)).replace(/\./g, '%2E');
}

export function customerNationalIdIndexRef(
  firestore: Firestore,
  institutionId: string,
  nationalId: unknown
) {
  return doc(
    firestore,
    'institutions',
    institutionId,
    'customerNationalIds',
    nationalIdIndexKey(nationalId)
  );
}

/** Finds existing customers using the normalized field and legacy raw ID field. */
export async function findCustomerWithNationalId(
  firestore: Firestore,
  institutionId: string,
  nationalId: unknown,
  excludeCustomerId?: string
) {
  const customersRef = collection(firestore, 'institutions', institutionId, 'customers');
  const rawId = String(nationalId ?? '').trim();
  const normalizedId = normalizeNationalId(rawId);
  if (!normalizedId) return null;

  const [normalizedMatches, rawMatches] = await Promise.all([
    getDocs(query(customersRef, where('idNumber_lowercase', '==', normalizedId), limit(10))),
    getDocs(query(customersRef, where('idNumber', '==', rawId), limit(10))),
  ]);

  const matches = new Map<string, { id: string; idNumber?: string }>();
  for (const snapshot of [normalizedMatches, rawMatches]) {
    snapshot.forEach((customerDoc) => {
      const data = customerDoc.data();
      if (normalizeNationalId(data.idNumber) === normalizedId) {
        matches.set(customerDoc.id, { id: customerDoc.id, idNumber: data.idNumber });
      }
    });
  }

  return [...matches.values()].find((customer) => customer.id !== excludeCustomerId) ?? null;
}
