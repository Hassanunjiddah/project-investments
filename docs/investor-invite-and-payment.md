# Investor invite & payment confirmation

## Entry

Investors open the shared project detail screen:

`/(tabs)/projects/[id]?invite=[inviteId]`

If `invite` is omitted, the app loads the current user’s invite for that project (`userId` + `projectId`).

Invitation list routes redirect to the same project detail URL.

## Invite lookup

`fetchInvite` / `useFetchInvitation` accepts either:

- `{ inviteId }` — by invitation id
- `{ userId, projectId }` — investor’s invite for a project

## Visibility by invite status

| Status | Overview | Documents / Risks / Timeline | Payment tab | Footer |
| --- | --- | --- | --- | --- |
| `INVITED` | Teaser | Locked | Hidden | Accept / Decline |
| `ACCEPTED` … `PROOF_SUBMITTED` | Teaser | Locked | Shown | — |
| `CONFIRMED` | Full | Unlocked | Hidden | — |
| `DECLINED` | Blocked | — | — | — |

Investable max (commit + financial card):

```
min(invite.max_investment_amount_minor ?? ∞, project.target_minor - project.raised_minor)
```

## Payment confirmation task

1. Investor commits via RPC `commit_invite_investment` (server enforces the investable max).
2. Investor uploads proof via `submit-payment-proof` → invite `PROOF_SUBMITTED` and a `CONFIRM_PAYMENT_PROOF` task for the line manager (`tasks.invite_id` set).
3. Manager confirms from the project **Investors** tab → edge `confirm-invite-payment` → RPC `confirm_invite_payment`:
   - invite → `CONFIRMED`
   - `projects.raised_minor` += committed amount
   - matching task → `COMPLETED`
