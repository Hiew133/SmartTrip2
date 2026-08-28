import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';

/* Rules decide who can read and write real money data, so they get tested
   against the emulator rather than eyeballed. Run with:
     npm run test:rules                                                     */

let env;

const OWNER = 'uid-owner';
const EDITOR = 'uid-editor';
const VIEWER = 'uid-viewer';
const STRANGER = 'uid-stranger';
const INVITEE = 'uid-invitee';
const INVITEE_EMAIL = 'moi@x.vn';

const tripData = (over = {}) => ({
  title: 'Đà Nẵng – Hội An',
  members: [
    { id: 'm1', name: 'Minh', email: 'minh@x.vn', role: 'owner', pending: false, uid: OWNER },
    { id: 'm2', name: 'Lan', email: 'lan@x.vn', role: 'edit', pending: false, uid: EDITOR },
    { id: 'm3', name: 'An', email: 'an@x.vn', role: 'view', pending: false, uid: VIEWER },
    { id: 'm4', name: 'Moi', email: INVITEE_EMAIL, role: 'edit', pending: true, uid: null },
  ],
  memberIds: [OWNER, EDITOR, VIEWER],
  roles: { [OWNER]: 'owner', [EDITOR]: 'edit', [VIEWER]: 'view' },
  pendingEmails: [INVITEE_EMAIL],
  ownerId: OWNER,
  plan: 16000000,
  settled: {},
  createdAt: 1,
  ...over,
});

const as = (uid) => env.authenticatedContext(uid).firestore();
/** Signed in with a token that carries an email, verified or not. */
const asEmail = (uid, email, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore();

/** What the client writes when it seats itself: uid filled in, email dropped. */
const claimed = (over = {}) => {
  const base = tripData();
  const members = base.members.map((m) => (m.email === INVITEE_EMAIL
    ? { ...m, uid: INVITEE, pending: false } : m));
  return {
    ...base,
    members,
    memberIds: [OWNER, EDITOR, VIEWER, INVITEE],
    roles: { [OWNER]: 'owner', [EDITOR]: 'edit', [VIEWER]: 'view', [INVITEE]: 'edit' },
    pendingEmails: [],
    ...over,
  };
};
/** What the client writes when a member gives up their own seat. */
const left = (who, over = {}) => {
  const base = tripData();
  const roles = { ...base.roles };
  delete roles[who];
  return {
    ...base,
    members: base.members.filter((m) => m.uid !== who),
    memberIds: base.memberIds.filter((id) => id !== who),
    roles,
    ...over,
  };
};

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

  /* ── claiming an invitation ─────────────────────────────────────────── */

  it('an invited person can read the trip waiting for them', async () => {
    await seed();
    await assertSucceeds(getDoc(tripRef(asEmail(INVITEE, INVITEE_EMAIL))));
  });

  /* The client does not read one document, it runs this query — and Firestore
     judges a list against the query itself, not the documents it would return.
     The single-document tests all passed while this failed in the real app. */
  it('an invited person can find their trips by query', async () => {
    await seed();
    const q = (fs, email) => query(collection(fs, 'trips'), where('pendingEmails', 'array-contains', email));
    await assertSucceeds(getDocs(q(asEmail(INVITEE, INVITEE_EMAIL), INVITEE_EMAIL)));
    // and the same query for somebody else's address is refused
    await assertFails(getDocs(q(asEmail(INVITEE, INVITEE_EMAIL), 'nguoikhac@x.vn')));
  });

  it('members still find their trips by query', async () => {
    await seed();
    const q = (fs, uid) => query(collection(fs, 'trips'), where('memberIds', 'array-contains', uid));
    await assertSucceeds(getDocs(q(as(VIEWER), VIEWER)));
    await assertFails(getDocs(q(as(STRANGER), VIEWER)));
  });

  it('an unverified address cannot read or claim', async () => {
    await seed();
    await assertFails(getDoc(tripRef(asEmail(INVITEE, INVITEE_EMAIL, false))));
    await assertFails(updateDoc(tripRef(asEmail(INVITEE, INVITEE_EMAIL, false)), claimed()));
  });

  it('an invited person can seat themselves', async () => {
    await seed();
    await assertSucceeds(updateDoc(tripRef(asEmail(INVITEE, INVITEE_EMAIL)), claimed()));
  });

  it('claiming cannot hand the claimer a role they were not offered', async () => {
    await seed();
    await assertFails(updateDoc(tripRef(asEmail(INVITEE, INVITEE_EMAIL)), claimed({
      roles: { [OWNER]: 'owner', [EDITOR]: 'edit', [VIEWER]: 'view', [INVITEE]: 'owner' },
    })));
  });

  it('claiming cannot seat somebody else at the same time', async () => {
    await seed();
    await assertFails(updateDoc(tripRef(asEmail(INVITEE, INVITEE_EMAIL)), claimed({
      memberIds: [OWNER, EDITOR, VIEWER, INVITEE, STRANGER],
      roles: { [OWNER]: 'owner', [EDITOR]: 'edit', [VIEWER]: 'view', [INVITEE]: 'edit', [STRANGER]: 'edit' },
    })));
  });

  it('claiming cannot smuggle in an edit to the trip itself', async () => {
    await seed();
    await assertFails(updateDoc(tripRef(asEmail(INVITEE, INVITEE_EMAIL)), claimed({ plan: 1 })));
    await assertFails(updateDoc(tripRef(asEmail(INVITEE, INVITEE_EMAIL)), claimed({ title: 'Cướp' })));
  });

  it('someone else cannot claim an invitation addressed to another email', async () => {
    await seed();
    await assertFails(updateDoc(tripRef(asEmail(STRANGER, 'nguoila@x.vn')), claimed()));
    await assertFails(getDoc(tripRef(asEmail(STRANGER, 'nguoila@x.vn'))));
  });

  it('an invited person still cannot touch days or expenses before claiming', async () => {
    await seed();
    await assertFails(getDoc(dayRef(asEmail(INVITEE, INVITEE_EMAIL))));
    await assertFails(getDoc(expenseRef(asEmail(INVITEE, INVITEE_EMAIL))));
  });

  /* `members` and `pendingEmails` are not read by any rule, which is exactly
     why they were left unguarded — and why an editor could quietly wreck or
     leak the trip through them while keeping the mirrors pristine. */

  it('an editor cannot rewrite the members list', async () => {
    await seed();
    // emptying it makes the trip vanish from every client, the document intact
    await assertFails(updateDoc(tripRef(as(EDITOR)), { ...tripData(), members: [] }));
    // and the owner's own row is not the editor's to rewrite
    await assertFails(updateDoc(tripRef(as(EDITOR)), {
      ...tripData({
        members: tripData().members.map((m) => (m.role === 'owner'
          ? { ...m, name: 'Kẻ giả mạo', email: 'attacker@evil.vn' } : m)),
      }),
    }));
  });

  it('an editor cannot hand a stranger read access through pendingEmails', async () => {
    await seed();
    await assertFails(updateDoc(tripRef(as(EDITOR)), {
      ...tripData({ pendingEmails: [INVITEE_EMAIL, 'nguoila@x.vn'] }),
    }));
    await assertFails(getDoc(tripRef(asEmail(STRANGER, 'nguoila@x.vn'))));
  });

  it('the owner may still edit members and invitations', async () => {
    await seed();
    await assertSucceeds(updateDoc(tripRef(as(OWNER)), {
      ...tripData({ pendingEmails: [INVITEE_EMAIL, 'ban@x.vn'] }),
    }));
  });

  it('a member can give up their own seat', async () => {
    await seed();
    await assertSucceeds(updateDoc(tripRef(as(VIEWER)), left(VIEWER)));
    await seed();
    await assertSucceeds(updateDoc(tripRef(as(EDITOR)), left(EDITOR)));
  });

  it('leaving cannot promote anyone or edit the trip on the way out', async () => {
    await seed();
    await assertFails(updateDoc(tripRef(as(EDITOR)), left(EDITOR, { plan: 1 })));
    await seed();
    await assertFails(updateDoc(tripRef(as(EDITOR)), left(EDITOR, { title: 'Cướp' })));
    await seed();
    await assertFails(updateDoc(tripRef(as(EDITOR)), left(EDITOR, {
      roles: { [OWNER]: 'owner', [VIEWER]: 'edit' },
    })));
  });

  it('leaving takes one seat, not two', async () => {
    await seed();
    const base = tripData();
    await assertFails(updateDoc(tripRef(as(EDITOR)), {
      ...base,
      members: base.members.filter((m) => m.uid !== EDITOR && m.uid !== VIEWER),
      memberIds: [OWNER],
      roles: { [OWNER]: 'owner' },
    }));
  });

  it('a stranger cannot use the leave path to touch the trip', async () => {
    await seed();
    await assertFails(updateDoc(tripRef(as(STRANGER)), left(EDITOR)));
  });

  it('nothing outside /trips is reachable', async () => {
    await assertFails(getDoc(doc(as(OWNER), 'secrets', 'x')));
    await assertFails(setDoc(doc(as(OWNER), 'secrets', 'x'), { a: 1 }));
  });
});
