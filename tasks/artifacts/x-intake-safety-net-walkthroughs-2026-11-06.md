# X intake safety net: setup walkthroughs (for TJ)

This covers layer 2, the self-hosted FxEmbed mirror on Cloudflare, and layer 3, twscrape on a Raspberry Pi. The design is in `x-intake-safety-net-design-2026-11-06.md`.

**You do every step that involves an account, a cookie or a secret.** Claude never sees those values. Steps marked **(approval)** are production changes, made after you say yes in a pop-up.

---

## A. Layer 2: your own FxEmbed mirror on Cloudflare (free)

**What you get:** a copy of FxTwitter's API at `https://<name>.<your-subdomain>.workers.dev`. The poller calls it whenever `api.fxtwitter.com` misses. To start, it uses **no X account**.

1. **Create a free Cloudflare account** at https://dash.cloudflare.com/sign-up. In the dashboard, choose **Workers & Pages**. That gives you a `*.workers.dev` subdomain.
2. **Copy your Account ID** from the right-hand side of the Workers & Pages overview.
3. **On your Mac, outside the FHFH repo:**
   ```bash
   mkdir -p ~/Code/fxembed-mirror && cd ~/Code/fxembed-mirror
   git clone https://github.com/FxEmbed/FxEmbed.git .
   nvm install 24 && nvm use 24      # FxEmbed asks for the current Node LTS (24.x)
   npm install
   cp wrangler.example.toml wrangler.toml
   cp .env.example .env
   cp branding.example.json branding.json
   ```
4. **Edit `wrangler.toml`:**
   - Set `account_id` to your Account ID.
   - Set `name` to something like `fhfh-fx`. That name becomes the hostname.
   - Delete the `analytics_engine_datasets` section, since you don't need it.
5. **Edit `.env`:**
   - Set `API_HOST_LIST` to your worker's hostname, for example `fhfh-fx.<your-subdomain>.workers.dev`. FxEmbed only answers API calls on hosts in this list.
   - Leave `SENTRY_*` empty.
   - Leave the other domain lists as they are.
6. **Log in and deploy:**
   ```bash
   npx wrangler login     # opens the browser; approve
   npm run deploy
   ```
   Note the `https://….workers.dev` URL it prints.
7. **Probe it (approval):** I run about 20 read-only requests, across the 7 accounts, to `<url>/2/profile/<handle>/statuses?count=20`. That tells us whether profile feeds work without X credentials.
   - **If they do:** go to step 8.
   - **If they don't:** you decide between a burner account's credentials in FxEmbed (`credentials.json`, encrypted with a `CREDENTIAL_KEY` secret) and relying on layer 3 alone.
8. **Point the poller at the mirror (approval):** set the edge-function secret `FXTWITTER_MIRROR_BASE=https://fhfh-fx.<your-subdomain>.workers.dev` (Supabase dashboard → Edge Functions → Secrets). Then deploy poller v6. Until the secret exists, v6 behaves like v5 plus gap recovery.
9. **Updating later:** in `~/Code/fxembed-mirror`, run `git pull && npm install && npm run deploy`.

**Free-plan headroom:** at most about 15,000 mirror requests a day, against Cloudflare's 100,000.

---

## B. Layer 3: twscrape with a burner account on a Raspberry Pi

**What you get:** a job that wakes every 4 minutes and asks Supabase whether any switched account has gone 6 minutes without a good poller read.
- **Usually the answer is no,** and the job never touches X.
- **If yes,** it reads that account's latest 20 posts with the burner and sends them to the `x-timeline-ingest` edge function, which stores them with the poller's own code.
- **Once every 15 minutes** it also reads every switched account as a cross-check, because FxTwitter's feed can answer normally and still be stale. That's about 28 reads an hour.

**You need:** a Pi 3, 4 or 5 running Raspberry Pi OS (Bookworm, 64-bit Lite is fine), on your home network with SSH enabled. If you have never used a Pi, do B0 first.

### B0. First-time Raspberry Pi setup (no Pi experience needed)

**What you need:**
- the Pi itself;
- its **official power supply**: USB-C for a Pi 4 or 5, micro-USB for a Pi 3;
- a **microSD card** of 16 GB or more, plus a way to plug it into your Mac (built-in slot or a USB card reader);
- your home Wi-Fi name and password, or an Ethernet cable to your router.

You don't need a screen, keyboard or mouse. You'll control the Pi from your Mac's Terminal over the network ("headless").

1. **Install Raspberry Pi Imager** on your Mac from https://www.raspberrypi.com/software/, and plug the microSD card into the Mac.
2. **Choose what to write.** In Imager:
   - **Choose Device:** your Pi model.
   - **Choose OS:** *Raspberry Pi OS (other)* → **Raspberry Pi OS Lite (64-bit)**.
   - **Choose Storage:** the microSD card. Double-check it is the card, because it gets erased.
3. **Edit settings.** Click **Next**; when asked about OS customisation, choose **Edit settings**:
   - **General:**
     - hostname `fhfh-pi`;
     - set a **username**, for example `tj`, and a password you'll remember. This is your Pi login, nothing to do with X;
     - tick *Configure wireless LAN* and enter your Wi-Fi name and password, with your country (unless you'll use Ethernet);
     - set the locale and time zone.
   - **Services:** tick **Enable SSH** → *Use password authentication*.
   - **Save**, then **Yes** to apply the settings, and **Yes** to write. It takes a few minutes.
4. **Boot it.** Put the card into the Pi (the slot is underneath, on the short edge), connect Ethernet if you're using it, then plug in power. Wait about 2 minutes for the first boot. There's no on/off switch; power on means on.
5. **Connect from your Mac's Terminal:**
   ```bash
   ssh tj@fhfh-pi.local
   ```
   Use your username. Type `yes` to trust it the first time, then your Pi password.
   - **If `fhfh-pi.local` isn't found,** wait a minute and retry.
   - **If it's still not found,** look up the Pi's IP address in your router's device list, and use `ssh tj@<that IP>`.
6. **Update it once:**
   ```bash
   sudo apt update && sudo apt full-upgrade -y && sudo reboot
   ```
   Wait a minute after the reboot, then SSH in again.
7. **Python check:** run `python3 --version`. It should print 3.11 or newer, and Bookworm ships with it.
8. **Where to keep it:**
   - Leave the Pi plugged in somewhere with good Wi-Fi or Ethernet. It uses about as much power as a phone charger.
   - To shut it down safely: `sudo shutdown now`, then unplug.
   - To start it again: plug it back in; the timer from step 8 below restarts by itself.

In the steps below, `<user>@raspberrypi.local` means `tj@fhfh-pi.local`, using your own username and hostname.

1. **Make the burner X account yourself.**
   - Use a fresh email address.
   - Don't link it to your own accounts.
   - Follow nothing, and don't post. It only reads public profiles.
   - Log in once in a normal browser on your home network, and complete any check X asks for.
2. **Copy its two cookies** while logged in: Chrome → DevTools → Application → Cookies → `https://x.com`. Keep the values of **`auth_token`** and **`ct0`** to hand for step 5. Don't paste them into chat or any file in the repo.
3. **Copy the job to the Pi** from the FHFH repo on your Mac:
   ```bash
   scp -r tools/x-twscrape-fallback <user>@raspberrypi.local:~/x-twscrape-fallback
   ```
   `<user>` is the username you chose when you flashed the Pi. Newer images have no `pi` user.
4. **On the Pi, install it:**
   ```bash
   cd ~/x-twscrape-fallback
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   ```
5. **On the Pi, add the burner:**
   ```bash
   .venv/bin/twscrape --db accounts.db add_cookie <burner_username>
   ```
   When it prompts, paste `auth_token=<value>; ct0=<value>`. The cookies are stored only in `accounts.db`, on the Pi. Then:
   ```bash
   chmod 600 accounts.db
   ```
6. **Ingest secret (approval for the SQL):**
   - **First,** with your approval, I apply `supabase/functions/x-timeline-ingest/setup.sql` and generate the Vault secret `x_timeline_ingest_secret` inside Postgres, then deploy `x-timeline-ingest`.
   - **Then you,** in the Supabase SQL editor, run:
     ```sql
     select decrypted_secret from vault.decrypted_secrets where name = 'x_timeline_ingest_secret';
     ```
   - **Copy the value and paste it** into the Pi's env file:
     ```bash
     cp .env.example .env && nano .env      # paste after X_INGEST_SECRET=
     chmod 600 .env
     ```
7. **Test once, forcing one account:**
   ```bash
   X_FALLBACK_FORCE=nhl_rosters .venv/bin/python fallback.py
   ```
   Expect one JSON line, `"event": "ingested"` with `"status": 200`. `inserted` is usually 0, because the poller already has those posts. That is fine.
8. **Run it on a timer:** edit `User=` and the two paths in `x-twscrape-fallback.service` to match your user, then:
   ```bash
   sudo cp x-twscrape-fallback.service x-twscrape-fallback.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now x-twscrape-fallback.timer
   journalctl -u x-twscrape-fallback -f      # watch: mostly "idle", plus "ingested" with reason "cross_check" every 15 min
   ```
9. **To stop it:** `sudo systemctl disable --now x-twscrape-fallback.timer`.
10. **To cut the Pi off:** rotate the Vault secret (the last lines of `setup.sql`). To retire the burner, log it out in any browser; that invalidates its cookies.

**If X locks the burner:** runs log `read_failed`. Log in to the burner in a browser, clear the check, copy the new cookies, and repeat step 5.
