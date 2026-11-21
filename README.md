# SMSTunnel for NodeBB

Texts for your forum, sent from your own Android phone and number through [SMSTunnel](https://smstunnel.io).

- **Staff alerts:** a text to the numbers you saved when a post is flagged or waits in the post queue.
- **Member texts:** members can turn on a text for replies to their posts and for mentions, to a number they confirm
  with a code. They can turn it off or remove the number at any time, on their own settings page.

There is no way to text all members, and nobody gets a text they didn't turn on. Installing the plugin changes nothing
until you turn it on.

Requires NodeBB 4.16.9 or later. Tested on 4.16.9 with MongoDB, in a cluster of two processes.

## Set up

1. Install it from **Admin > Extend > Plugins**, or run `npm install nodebb-plugin-smstunnel` in your NodeBB folder.
   Activate it, then rebuild and restart.
2. In your [SMSTunnel dashboard](https://smstunnel.io), link your phone and create a key under **Apps**.
3. Open **Admin > Plugins > SMSTunnel**, paste the key, turn the plugin on and save.
4. For alerts, add a staff number and type in the code it receives. **Send test text** checks that it works.
5. For member texts, turn them on. Each member then finds **Text messages** at the bottom of their settings page.

If you'd rather not keep the key in the database, put it in `config.json` or the environment. It then takes priority
over the settings page:

```json
{ "smstunnel": { "apiKey": "your key" } }
```

```
smstunnel__apiKey=your key
```

## What a text says

Texts use fixed wording in English and carry a link, never the words of a post.

```
My Forum: Ana replied to your post. https://forum.example/post/123 Turn these texts off in your forum settings.
My Forum: 2 posts were flagged. Review: https://forum.example/flags
```

A member's name appears only with its links, domains, digits and invisible characters removed. If nothing safe is left,
the text says "A member".

## Who gets a text

- **Replies:** only the person whose post was answered, and only if the forum would notify them. Other followers of the
  topic get no text.
- **Mentions:** only people named directly, at most three per post. Group mentions and chat messages send no text.
- **Staff:** up to five numbers, each confirmed with a code. Alerts are grouped: at most one of each kind in 10 minutes.

Before a text goes out, and again about 15 seconds later just before sending, the plugin checks that this member can
read the post. If the post was removed or moved, or if this can't be established, nothing is sent. Guests and accounts
from other servers can't cause a text.

## Limits

| What | Limit |
| --- | --- |
| Texts per member | 3 an hour and 5 a day (you can change these), and one per topic an hour |
| Texts caused by one author | 10 an hour |
| Member texts for the forum | 100 a day (you can change this) |
| Confirmation codes | 3 a day per number, 3 a day per member, 3 an hour and 10 a day per IP, 20 a day per forum |
| A code | 6 digits, valid for 10 minutes, 5 tries |

Behind a reverse proxy, set `trust_proxy` in NodeBB's `config.json` so the limits per IP see the real address.

## Good to know

- Texts go out as ordinary texts from your phone, under your mobile plan.
- A phone sends about 28 SMS parts every 65 seconds, which is Android's limit. If it's offline, a text waits for up to
  3 days.
- A text is sent once. After a refusal, a timeout or a lost answer it isn't tried again, and the settings page shows the
  reason.
- The key stays on your server. Logs hold no numbers, codes or texts.
- Numbers are stored in your forum's database, and a member's number is deleted with their account.

## License

[MIT](LICENSE). Copyright (c) 2026 NARBOWEB SRL. Support: support@smstunnel.io
