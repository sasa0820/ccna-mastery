import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProgressRecord } from '../types/question';
import { GlobalResumeEntry, ResumeEntry, ResumeState } from '../utils/studyResumeAndSync';
import {
  buildGlobalResumeCreatePayload,
  buildGlobalResumeUpdatePayload,
  buildQuestionProgressCreatePayload,
  buildQuestionProgressUpdatePayload,
  buildScopeResumeCreatePayload,
  buildScopeResumeUpdatePayload,
  buildUserProfileCreatePayload,
  buildUserProfileUpdatePayload,
  isValidFirestoreId,
  parseGlobalResumeDoc,
  parseQuestionProgressDoc,
  parseScopeResumeDoc,
  toFirestoreScopeId,
} from '../utils/firestoreSyncHelpers';

export interface CloudSnapshotData {
  records: Record<string, UserProgressRecord>;
  resumeState: ResumeState;
  knownProgressIds: Set<string>;
  knownScopeIds: Set<string>;
  hasGlobalResume: boolean;
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  let exists = false;
  try {
    const snap = await getDoc(userRef);
    exists = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!exists) {
    try {
      await setDoc(
        userRef,
        buildUserProfileCreatePayload(
          user.uid,
          user.displayName,
          user.email,
          user.photoURL,
          serverTimestamp(),
          serverTimestamp()
        )
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    try {
      await updateDoc(
        userRef,
        buildUserProfileUpdatePayload(
          user.displayName,
          user.email,
          user.photoURL,
          serverTimestamp()
        )
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export async function fetchInitialCloudStudyData(uid: string): Promise<CloudSnapshotData> {
  const progressPath = `users/${uid}/progress`;
  const globalResumePath = `users/${uid}/resume/global`;
  const scopesPath = `users/${uid}/resumeScopes`;

  const records: Record<string, UserProgressRecord> = {};
  const knownProgressIds = new Set<string>();
  const byScope: Record<string, ResumeEntry> = {};
  const knownScopeIds = new Set<string>();
  let lastGlobal: GlobalResumeEntry | undefined;
  let hasGlobalResume = false;

  try {
    const qProgress = query(collection(db, 'users', uid, 'progress'), where('uid', '==', uid));
    const progressSnap = await getDocs(qProgress);
    progressSnap.forEach((docSnap) => {
      knownProgressIds.add(docSnap.id);
      const parsed = parseQuestionProgressDoc(docSnap.data());
      if (parsed) {
        records[parsed.questionId] = parsed;
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, progressPath);
  }

  try {
    const globalSnap = await getDoc(doc(db, 'users', uid, 'resume', 'global'));
    if (globalSnap.exists()) {
      hasGlobalResume = true;
      const parsed = parseGlobalResumeDoc(globalSnap.data());
      if (parsed) {
        lastGlobal = parsed;
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, globalResumePath);
  }

  try {
    const qScopes = query(collection(db, 'users', uid, 'resumeScopes'), where('uid', '==', uid));
    const scopesSnap = await getDocs(qScopes);
    scopesSnap.forEach((docSnap) => {
      knownScopeIds.add(docSnap.id);
      const parsed = parseScopeResumeDoc(docSnap.data());
      if (parsed) {
        byScope[parsed.scopeKey] = parsed.entry;
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, scopesPath);
  }

  return {
    records,
    resumeState: { lastGlobal, byScope },
    knownProgressIds,
    knownScopeIds,
    hasGlobalResume,
  };
}

export function subscribeCloudStudyData(
  uid: string,
  callbacks: {
    onProgressChange: (records: Record<string, UserProgressRecord>, docIds: Set<string>) => void;
    onGlobalResumeChange: (entry: GlobalResumeEntry | undefined, exists: boolean) => void;
    onScopesChange: (byScope: Record<string, ResumeEntry>, scopeIds: Set<string>) => void;
    onError: (err: unknown) => void;
  }
): () => void {
  const unsubscribers: Unsubscribe[] = [];

  const progressPath = `users/${uid}/progress`;
  const qProgress = query(collection(db, 'users', uid, 'progress'), where('uid', '==', uid));
  unsubscribers.push(
    onSnapshot(
      qProgress,
      (snapshot) => {
        const nextRecords: Record<string, UserProgressRecord> = {};
        const docIds = new Set<string>();
        snapshot.forEach((docSnap) => {
          docIds.add(docSnap.id);
          const parsed = parseQuestionProgressDoc(docSnap.data());
          if (parsed) {
            nextRecords[parsed.questionId] = parsed;
          }
        });
        callbacks.onProgressChange(nextRecords, docIds);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, progressPath);
        } catch (wrapped) {
          callbacks.onError(wrapped);
        }
      }
    )
  );

  const globalPath = `users/${uid}/resume/global`;
  unsubscribers.push(
    onSnapshot(
      doc(db, 'users', uid, 'resume', 'global'),
      (docSnap) => {
        if (!docSnap.exists()) {
          callbacks.onGlobalResumeChange(undefined, false);
          return;
        }
        const parsed = parseGlobalResumeDoc(docSnap.data());
        callbacks.onGlobalResumeChange(parsed || undefined, true);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, globalPath);
        } catch (wrapped) {
          callbacks.onError(wrapped);
        }
      }
    )
  );

  const scopesPath = `users/${uid}/resumeScopes`;
  const qScopes = query(collection(db, 'users', uid, 'resumeScopes'), where('uid', '==', uid));
  unsubscribers.push(
    onSnapshot(
      qScopes,
      (snapshot) => {
        const nextScopes: Record<string, ResumeEntry> = {};
        const scopeIds = new Set<string>();
        snapshot.forEach((docSnap) => {
          scopeIds.add(docSnap.id);
          const parsed = parseScopeResumeDoc(docSnap.data());
          if (parsed) {
            nextScopes[parsed.scopeKey] = parsed.entry;
          }
        });
        callbacks.onScopesChange(nextScopes, scopeIds);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, scopesPath);
        } catch (wrapped) {
          callbacks.onError(wrapped);
        }
      }
    )
  );

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

export async function upsertQuestionProgress(
  uid: string,
  record: UserProgressRecord,
  knownProgressIds: Set<string>
): Promise<void> {
  if (!isValidFirestoreId(record.questionId)) return;
  const path = `users/${uid}/progress/${record.questionId}`;
  const docRef = doc(db, 'users', uid, 'progress', record.questionId);
  const existsInCloud = knownProgressIds.has(record.questionId);

  if (existsInCloud) {
    try {
      await updateDoc(docRef, buildQuestionProgressUpdatePayload(record, serverTimestamp()));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    try {
      await setDoc(
        docRef,
        buildQuestionProgressCreatePayload(uid, record, serverTimestamp(), serverTimestamp())
      );
      knownProgressIds.add(record.questionId);
    } catch (error) {
      // Fallback: if another device created this document concurrently, retry as update
      try {
        const check = await getDoc(docRef);
        if (check.exists()) {
          knownProgressIds.add(record.questionId);
          await updateDoc(docRef, buildQuestionProgressUpdatePayload(record, serverTimestamp()));
          return;
        }
      } catch {
        // Fall through to handleFirestoreError with original failure
      }
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

export async function upsertGlobalResume(
  uid: string,
  entry: GlobalResumeEntry,
  hasCloudGlobalRef: { current: boolean }
): Promise<void> {
  if (!isValidFirestoreId(entry.questionId)) return;
  const path = `users/${uid}/resume/global`;
  const docRef = doc(db, 'users', uid, 'resume', 'global');

  if (hasCloudGlobalRef.current) {
    try {
      await updateDoc(docRef, buildGlobalResumeUpdatePayload(entry, serverTimestamp()));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    try {
      await setDoc(
        docRef,
        buildGlobalResumeCreatePayload(uid, entry, serverTimestamp(), serverTimestamp())
      );
      hasCloudGlobalRef.current = true;
    } catch (error) {
      try {
        const check = await getDoc(docRef);
        if (check.exists()) {
          hasCloudGlobalRef.current = true;
          await updateDoc(docRef, buildGlobalResumeUpdatePayload(entry, serverTimestamp()));
          return;
        }
      } catch {
        // Fall through
      }
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

export async function upsertScopeResume(
  uid: string,
  scopeKey: string,
  entry: ResumeEntry,
  knownScopeIds: Set<string>
): Promise<void> {
  if (!isValidFirestoreId(entry.questionId)) return;
  const scopeId = toFirestoreScopeId(scopeKey);
  if (!isValidFirestoreId(scopeId)) return;
  const path = `users/${uid}/resumeScopes/${scopeId}`;
  const docRef = doc(db, 'users', uid, 'resumeScopes', scopeId);

  if (knownScopeIds.has(scopeId)) {
    try {
      await updateDoc(docRef, buildScopeResumeUpdatePayload(entry, serverTimestamp()));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    try {
      await setDoc(
        docRef,
        buildScopeResumeCreatePayload(uid, scopeKey, entry, serverTimestamp(), serverTimestamp())
      );
      knownScopeIds.add(scopeId);
    } catch (error) {
      try {
        const check = await getDoc(docRef);
        if (check.exists()) {
          knownScopeIds.add(scopeId);
          await updateDoc(docRef, buildScopeResumeUpdatePayload(entry, serverTimestamp()));
          return;
        }
      } catch {
        // Fall through
      }
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

interface PendingBatchOp {
  apply: (batch: ReturnType<typeof writeBatch>) => void;
}

export async function batchSyncStudyStateToCloud(
  uid: string,
  records: Record<string, UserProgressRecord>,
  resumeState: ResumeState,
  knownProgressIds: Set<string>,
  knownScopeIds: Set<string>,
  hasCloudGlobalRef: { current: boolean }
): Promise<void> {
  const ops: PendingBatchOp[] = [];
  const newlyCreatedProgressIds: string[] = [];
  const newlyCreatedScopeIds: string[] = [];
  let createdGlobal = false;

  for (const rec of Object.values(records)) {
    if (!isValidFirestoreId(rec.questionId)) continue;
    const hasActivity =
      rec.totalAttempts > 0 ||
      rec.isBookmarked ||
      Boolean(rec.userNote && rec.userNote.trim().length > 0);
    if (!hasActivity) continue;

    const docRef = doc(db, 'users', uid, 'progress', rec.questionId);
    if (knownProgressIds.has(rec.questionId)) {
      ops.push({
        apply: (b) => b.update(docRef, buildQuestionProgressUpdatePayload(rec, serverTimestamp())),
      });
    } else {
      newlyCreatedProgressIds.push(rec.questionId);
      ops.push({
        apply: (b) =>
          b.set(
            docRef,
            buildQuestionProgressCreatePayload(uid, rec, serverTimestamp(), serverTimestamp())
          ),
      });
    }
  }

  if (resumeState.lastGlobal && isValidFirestoreId(resumeState.lastGlobal.questionId)) {
    const globalRef = doc(db, 'users', uid, 'resume', 'global');
    const globalEntry = resumeState.lastGlobal;
    if (hasCloudGlobalRef.current) {
      ops.push({
        apply: (b) => b.update(globalRef, buildGlobalResumeUpdatePayload(globalEntry, serverTimestamp())),
      });
    } else {
      createdGlobal = true;
      ops.push({
        apply: (b) =>
          b.set(
            globalRef,
            buildGlobalResumeCreatePayload(uid, globalEntry, serverTimestamp(), serverTimestamp())
          ),
      });
    }
  }

  for (const [scopeKey, entry] of Object.entries(resumeState.byScope || {})) {
    if (!isValidFirestoreId(entry.questionId)) continue;
    const scopeId = toFirestoreScopeId(scopeKey);
    if (!isValidFirestoreId(scopeId)) continue;
    const scopeRef = doc(db, 'users', uid, 'resumeScopes', scopeId);
    if (knownScopeIds.has(scopeId)) {
      ops.push({
        apply: (b) => b.update(scopeRef, buildScopeResumeUpdatePayload(entry, serverTimestamp())),
      });
    } else {
      newlyCreatedScopeIds.push(scopeId);
      ops.push({
        apply: (b) =>
          b.set(
            scopeRef,
            buildScopeResumeCreatePayload(uid, scopeKey, entry, serverTimestamp(), serverTimestamp())
          ),
      });
    }
  }

  if (ops.length === 0) return;

  const CHUNK_SIZE = 450;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((op) => op.apply(batch));
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  }

  newlyCreatedProgressIds.forEach((id) => knownProgressIds.add(id));
  newlyCreatedScopeIds.forEach((id) => knownScopeIds.add(id));
  if (createdGlobal) {
    hasCloudGlobalRef.current = true;
  }
}

export async function clearCloudStudyData(
  uid: string,
  knownProgressIds: Set<string>,
  knownScopeIds: Set<string>,
  hasCloudGlobalRef: { current: boolean }
): Promise<void> {
  const refs = [
    ...Array.from(knownProgressIds).map((id) => doc(db, 'users', uid, 'progress', id)),
    ...Array.from(knownScopeIds).map((id) => doc(db, 'users', uid, 'resumeScopes', id)),
    ...(hasCloudGlobalRef.current ? [doc(db, 'users', uid, 'resume', 'global')] : []),
  ];

  const CHUNK_SIZE = 450;
  for (let i = 0; i < refs.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    refs.slice(i, i + CHUNK_SIZE).forEach((ref) => batch.delete(ref));
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  }

  knownProgressIds.clear();
  knownScopeIds.clear();
  hasCloudGlobalRef.current = false;
}
