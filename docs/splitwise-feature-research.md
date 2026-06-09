# Splitwise Feature — Research Report

> Research for implementing a Splitwise-style group expense-splitting feature in **DET**
> (Flutter app + Next.js/MongoDB REST API).
> Method: deep-research harness — 21 sources fetched, 25 claims adversarially verified
> (22 confirmed, 3 killed). Generated 2026-06-09.

---

## 1. Core product

Splitwise is a group expense-splitting **ledger**. You add a shared expense (who paid, the
total, and who owes), and it tracks running balances between people. **It records
who-owes-whom; by default it does not move real money.**

**Splitting methods:** equal · exact amounts · percentages · shares/adjustments · by-item.

**Multi-currency** conversion (same-day FX rates) is a **Pro-only** feature; the free tier just
keeps separate per-currency balances with no cross-currency netting. _[splitwise.com/pro]_

> ⚠️ **Not firmly verified** (confirm before building): real-money payment integrations
> (PayPal/Venmo), recurring shared expenses, and the comments/activity feed (free vs Pro).

---

## 2. Data model (standard Splitwise-style schema)

~7 entities _[Negi; InterviewReady; GeeksforGeeks]_:

- **User**
- **Group**
- **GroupMember** — `user_id` + `group_id` junction
- **Expense** — payer, total, group, split method
- **ExpenseSplit / share** — per-member owed amount for one expense
- **Settlement / Payment** — a recorded payback
- _(optional)_ **Balance**, **Reminder/Notification**

**Key design tradeoff** (the research split-voted 2-1 on this — both are legitimate):

- **Derive balances on read** from expense shares, **or**
- **Store** a denormalized per-pair `Balance` table for O(1) lookup.

> **Recommendation for DET v1: derive balances from shares.** It's simpler and it's the only
> approach that stays correct when an expense is edited/deleted — Splitwise recalculates
> "as if the payment never happened." _[helpdesk 843558]_

---

## 3. The "Simplify Debts" algorithm ⭐

**What it does:** reduces the *number of payments* needed to settle a group while every
person's **net balance stays exactly the same**. If A owes B and B owes C, A just pays C
directly. _[blog.splitwise.com/debts-made-simple, 2012]_

**Theory:** model people as graph nodes and payments as directed edges; find an equivalent
graph (same net per node) with the fewest edges. The true minimum is **NP-complete**
(reduction from Partition) — so it's never solved exactly in production. _[alexirpan.com]_

**Practical greedy heuristic** _[GeeksforGeeks; InterviewReady]_:

1. Compute each person's **net** = total received − total owed. (− = debtor, + = creditor.)
2. Repeatedly take the **largest creditor** and the **largest debtor**, transfer
   `min(|credit|, |debt|)`, record that payment, and drop whoever reaches zero.
3. Repeat until all nets are 0 (guaranteed to terminate — nets sum to zero). Commonly
   implemented with max-heaps.

> Caveat: greedy is not always minimal (a 7-person example yields 6 transactions vs. 5
> optimal) — perfectly acceptable in practice.

```
# Pseudocode
nets = { person: received - owed for each person }
creditors = maxheap of (net > 0)
debtors   = maxheap of (net < 0, by magnitude)
while creditors and debtors:
    c = creditors.pop(); d = debtors.pop()
    amt = min(c.net, -d.net)
    record_payment(from=d, to=c, amount=amt)
    if c.net - amt > 0: creditors.push(c.net - amt)
    if -d.net - amt > 0: debtors.push(-( -d.net - amt))
```

---

## 4. Balance math & edge cases

- **Net balance** per user = Σ received − Σ owed across all expenses + settlements.
- **Rounding:** `$10 / 3 → 3.33 / 3.33 / 3.34`; the **leftover cent is assigned randomly**
  (changed from "the payer eats it" for fairness over time). _[feedback forum]_
- **Partial settlements:** supported — the settle-up amount pre-fills to the full balance but
  is editable to any amount, leaving the remainder open. _[feedback forum]_
- **Edit/delete:** balances are **recomputed from the transaction set**, not patched — so
  deleting an expense cleanly reverses it. _[helpdesk 843558]_

---

## 5. Settle-up

Records an in-app payment (full or partial) and updates balances. Whether current Splitwise
also triggers real payment rails was **refuted/unsupported** in this research — verify
separately if real money movement is in scope.

---

## 6. UX flows worth mirroring

- **Add-expense sheet** with a split-method selector.
- **Group detail** showing per-member balances.
- **Settle-up sheet** — pre-filled with the balance, editable.
- **Activity feed.**

---

## 7. Recommended v1 for DET + mapping

DET today has: `Expense`, `Category`, `Debt` (lent/borrowed, free-text counterparty, optional
repayments), and `Account` + `AccountMembership` (shared-accounts invite/accept, owner/member).

| Splitwise concept     | DET mapping |
|-----------------------|-------------|
| Group                 | **New `Group` model** — reuse the `AccountMembership` invite/accept pattern you already built |
| Group member          | **New `GroupMember`** — clone the membership/role/invite machinery from shared-accounts |
| Shared expense + splits | **New `SharedExpense` + `ExpenseSplit`** — existing `Expense` is single-user, so net-new |
| Settlement            | Conceptually like a `Debt` repayment, but between app users → likely **new `Settlement`** |
| Balances              | **Derive from splits** (don't store) |
| Simplify debts        | **Greedy heuristic** as a derived view over the group's net balances |

**Suggested v1 scope:** groups + members (reusing the invite flow) → shared expense with
equal / exact / percentage / shares split → derived per-pair balances → in-app settle-up
(partial allowed) → optional greedy "simplify" view.

**Defer:** multi-currency netting, by-item splits, recurring shared expenses, real payment rails.

---

## Sources

**Primary (Splitwise official):**
- https://blog.splitwise.com/2012/09/14/debts-made-simple/
- https://feedback.splitwise.com/knowledgebase/articles/107220-what-does-the-simplify-debts-setting-do
- https://feedback.splitwise.com/knowledgebase/articles/843558-how-do-i-undo-a-settlement
- https://feedback.splitwise.com/forums/162446-general/suggestions/8278218-allow-partial-settlement-of-bills
- https://feedback.splitwise.com/forums/162446-general/suggestions/3309275-rotate-who-pays-the-extra-penny-when-the-bill-cann
- https://www.splitwise.com/pro
- https://feedback.splitwise.com/knowledgebase/articles/77463-can-i-split-an-expense-by-percentages
- https://feedback.splitwise.com/knowledgebase/articles/238785-how-do-i-create-a-recurring-bill

**Secondary (design / algorithm — Splitwise-*style* patterns, not confirmed internal schema):**
- https://www.alexirpan.com/2016/05/10/may-10.html (NP-completeness proof)
- https://medium.com/@interviewready/low-level-design-of-splitwise-f334c8f6ff77
- https://medium.com/@mithunmk93/algorithm-behind-splitwises-debt-simplification-feature-8ac485e97688
- https://www.geeksforgeeks.org/dsa/minimize-cash-flow-among-given-set-friends-borrowed-money/
- https://github.com/soumyasethy/ShortestPath-CashFlow-Algorithm-Splitwise
- https://medium.com/@sakshamnegi.dev/database-schema-design-of-splitwise-application-8fabea9bb28a
- https://www.linkedin.com/pulse/designing-splitwise-data-modelling-expense-sharing-shrey-batra

## Caveats

- Only Splitwise's own blog/helpdesk/feedback/pro pages are **primary**. The data model and
  exact greedy details come from **secondary** design articles/clones — these are
  Splitwise-*style* recommendations, **not** confirmed Splitwise production schema/code.
- Derived-on-read vs. denormalized per-pair balances is a genuine tradeoff; **derive-from-shares
  is recommended for DET v1.**
- NP-completeness and the greedy algorithm are timeless CS results; the rounding /
  partial-settlement quotes are 2012–2015 forum posts, corroborated as still current.

## Open questions

1. Does settle-up integrate with real payment rails (PayPal/Venmo), or only record in-app? (source refuted/unsupported)
2. Exact UX/validation for non-equal split methods (exact, %, shares, by-item) when splits don't sum to the total.
3. Recurring shared expenses + comments/activity feed — exist? free or Pro?
4. Can DET's `Debt` / `AccountMembership` be extended for group splits, or are net-new `Group` / `GroupMember` / `ExpenseSplit` models required? (needs a DET schema inspection)
