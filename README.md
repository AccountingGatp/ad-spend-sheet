# Ad Spend Sync

Fetches daily ad spend (Meta, Google, Pinterest, Applovin, Snap, TikTok) from Triple Whale and writes it into the
monthly Google Sheet. It finds each cell by the **date in the "Date" row** and the **label in column A**, so your sheet
layout and folders stay exactly as they are. It never touches formulas or any other cell.

Every run is two steps: **Fetch** shows a preview (nothing written), then **Feed data to sheet** writes only the cells
shown. After a fetch, step 4 exports the fetched numbers for the whole date range: Saint Daily CSV, Xero journals CSV and Excel.

## Setup (one time, about 30 minutes)

### 1. Put the code on GitHub and Vercel
1. Create an empty private repo on GitHub. On its page choose **Add file > Upload files**, drag in everything inside this folder
   (not the folder itself) and click **Commit**.
2. In Vercel choose **Add New > Project**, pick the repo and click **Deploy**. The first deploy will load but show setup
   errors until the settings below are added. That is expected.

### 2. Settings in Vercel
Open the project, then **Settings > Environment Variables**. Add these, then redeploy (Deployments > the latest > Redeploy).

| Name | Value |
|---|---|
| `APP_PASSWORD` | A password you choose for this app |
| `SESSION_SECRET` | Any long random text, 32+ characters |
| `TRIPLE_WHALE_API_KEY` | A new Triple Whale key (Data > APIs > Generate, tick only **Summary Page: Read**) |
| `TW_SHOP_DOMAIN` | `qtat02-wj.myshopify.com` |
| `GOOGLE_CLIENT_ID` | From step 3 |
| `GOOGLE_CLIENT_SECRET` | From step 3 |
| `GOOGLE_REFRESH_TOKEN` | From step 4 |

### 3. Google Cloud (sign in as accounting@gatpsolutions.com)
1. Go to console.cloud.google.com and create a project (choose your company organisation).
2. **APIs & Services > Library**, search **Google Sheets API**, click **Enable**.
3. **OAuth consent screen** (also called Google Auth Platform): app name `Ad Spend Sync`, your email as support contact.
   Set the audience / user type to **Internal**. Under **Data access** add the scope
   `https://www.googleapis.com/auth/spreadsheets`.
4. **Clients (Credentials) > Create OAuth client ID** > **Web application**. Under *Authorized redirect URIs* add
   `https://YOUR-APP.vercel.app/api/google/callback` (use your real Vercel address). Create it and copy the **Client ID**
   and **Client secret** into Vercel.
5. Redeploy.

If you cannot create a project, ask your Google Workspace admin to allow it or to create the project for you.

### 4. Connect Google once
Sign in to the app, then open `https://YOUR-APP.vercel.app/api/google/connect`. Approve with
accounting@gatpsolutions.com. The next page shows a long key. Copy it into the Vercel setting `GOOGLE_REFRESH_TOKEN`
and redeploy. You stay connected until you remove the app from your Google account.

## Daily and monthly use
- **New month:** paste the new sheet's link in step 1 and click **Save and check**. The app opens the sheet and shows which
  month it is, from the dates in the sheet. The link is remembered in that browser until you change it.
- **Each day:** pick the date (it starts on yesterday), click **Fetch from Triple Whale**, check the preview, then
  click **Feed data to sheet**.
- Today's date is blocked, because Triple Whale's figures for a day are not final until it ends.

## What the colours mean
- **Green** the cell is empty and will be filled.
- **Grey** the sheet already has this value.
- **Amber** the sheet has a different value. It is left alone unless you tick the overwrite box.
- **Red** a problem: Triple Whale did not return it, the date is not in the sheet, or the cell is a formula. These are skipped.

## Notes
- Triple Whale values are rounded to 2 decimals. Meta and Google can differ by a small amount from what was typed earlier,
  because ad platforms revise recent spend.
- A channel with no row in the sheet (for example Applovin in an older month) is skipped and shown as "no row in sheet".
- The sheet's first tab is used unless the link points to a specific tab.
- Dates and rows are found by the "Date" label and by labels like "Advertisment Spend - Meta" in column A.
  If you rename those, keep the channel name in the label.
