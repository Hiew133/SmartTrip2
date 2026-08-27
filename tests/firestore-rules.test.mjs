import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

/* Rules decide who can read and write real money data, so they get tested
   against the emulator rather than eyeballed. Run with:
     npm run test:rules                                                     */

let env;

const OWNER = 'uid-owner';
const EDITOR = 'uid-editor';
const VIEWER = 'uid-viewer';
const STRANGER = 'uid-stranger';

const tripData = (over = {}) => ({
  title: 'Đà Nẵng – Hội An',
  members: [
    { id: 'm1', name: 'Minh', email: 'minh@x.vn', role: 'owner', pending: false, uid: OWNER },
    { id: 'm2', name: 'Lan', email: 'lan@x.vn', role: 'edit', pending: false, uid: EDITOR },
    { id: 'm3', name: 'An', email: 'an@x.vn', role: 'view', pending: false, uid: VIEWER },
  ],
  memberIds: [OWNER, EDITOR, VIEWER],
  roles: { [OWNER]: 'owner', [EDITOR]: 'edit', [VIEWER]: 'view' },
  ownerId: OWNER,
  plan: 16000000,
  settled: {},
  createdAt: 1,
  ...over,
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const tripRef = (fs, id = 'trip1') => doc(fs, 'trips', id);
const expenseRef = (fs, id = 'e1') => doc(fs, 'trips', 'trip1', 'expenses', id);
const dayRef = (fs, id = 'd1') => doc(fs, 'trips', 'trip1', 'days', id);

describe('firestore.rules', () => {
  before(async () => {
    env = await initializeTestEnvironment({
      projectId: 'smarttrip-rules-test',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    });
  });

  after(async () => { await env?.cleanup(); });

  const seed = async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const fs = ctx.firestore();
      await setDoc(tripRef(fs), tripData());
      await setDoc(dayRef(fs), { place: 'Đà Nẵng', items: [], order: 0 });
      await setDoc(expenseRef(fs), { name: 'Vé máy bay', cat: 'Đi lại', payerId: 'm1', amount: 4800000, createdAt: 1 });
    });
  };

  it('members can read the trip, strangers cannot', async () => {
    await seed();
    await assertSucceeds(getDoc(tripRef(as(VIEWER))));
    await assertFails(getDoc(tripRef(as(STRANGER))));
    await assertFails(getDoc(tripRef(env.unauthenticatedContext().firestore())));
  });

  it('editors can change trip content, viewers cannot', async () => {
    await seed();
    await assertSucceeds(updateDoc(tripRef(as(EDITOR)), { ...tripData(), plan: 20000000 }));
    await assertFails(updateDoc(tripRef(as(VIEWER)), { ...tripData(), plan: 1 }));
  });

  it('an editor cannot promote themselves to owner', async () => {
    await seed();
    await assertFails(updateDoc(tripRef(as(EDITOR)), {
      ...tripData({ roles: { [OWNER]: 'owner', [EDITOR]: 'owner', [VIEWER]: 'view' } }),
    }));
  });

  it('an editor cannot add themselves a new member seat', async () => {
    await seed();
    await assertFails(updateDoc(tripRef(as(EDITOR)), {
      ...tripData({
        memberIds: [OWNER, EDITOR, VIEWER, STRANGER],
        roles: { [OWNER]: 'owner', [EDITOR]: 'edit', [VIEWER]: 'view', [STRANGER]: 'edit' },
      }),
    }));
  });

  it('the owner can change roles', async () => {
    await seed();
    await assertSucceeds(updateDoc(tripRef(as(OWNER)), {
      ...tripData({ roles: { [OWNER]: 'owner', [EDITOR]: 'view', [VIEWER]: 'view' } }),
    }));
  });

  it('only the owner can delete the trip', async () => {
    await seed();
    await assertFails(deleteDoc(tripRef(as(EDITOR))));
    await assertSucceeds(deleteDoc(tripRef(as(OWNER))));
  });

  it('expenses follow the trip role', async () => {
    await seed();
    await assertSucceeds(getDoc(expenseRef(as(VIEWER))));
    await assertFails(getDoc(expenseRef(as(STRANGER))));
    await assertSucceeds(setDoc(expenseRef(as(EDITOR), 'e2'), { name: 'Ăn tối', cat: 'Ăn uống', payerId: 'm2', amount: 500000, createdAt: 2 }));
    await assertFails(setDoc(expenseRef(as(VIEWER), 'e3'), { name: 'X', cat: 'Khác', payerId: 'm3', amount: 1, createdAt: 3 }));
  });

  it('days follow the trip role', async () => {
    await seed();
    await assertSucceeds(getDoc(dayRef(as(VIEWER))));
    await assertFails(getDoc(dayRef(as(STRANGER))));
    await assertSucceeds(updateDoc(dayRef(as(EDITOR)), { place: 'Hội An' }));
    await assertFails(updateDoc(dayRef(as(VIEWER)), { place: 'Hack' }));
  });

  it('a new trip must name its creator as the sole owner', async () => {
    await env.clearFirestore();
    const mine = tripData({ memberIds: [OWNER], roles: { [OWNER]: 'owner' } });
    await assertSucceeds(setDoc(tripRef(as(OWNER), 'new1'), mine));
    // cannot create a trip that hands someone else the keys
    await assertFails(setDoc(tripRef(as(EDITOR), 'new2'), mine));
  });

  it('nothing outside /trips is reachable', async () => {
    await assertFails(getDoc(doc(as(OWNER), 'secrets', 'x')));
    await assertFails(setDoc(doc(as(OWNER), 'secrets', 'x'), { a: 1 }));
  });
});
