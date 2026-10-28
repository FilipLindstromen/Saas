# LinguaFlash

An RSVP (Rapid Serial Visual Presentation) speed-reading app for learning
Swedish/English vocabulary. Paste in word or sentence pairs and it flashes
them one at a time — alternating Swedish then English — auto-advancing so
you never touch a "next" button.

## Input format

One pair per line, `svenska - english`:

```
hus - house
bil - car
jag bor i ett hus - I live in a house
```

Any of `-`, `–`, `—`, `|` or a tab also work as the separator (handy for
pasting from a spreadsheet). A line can hold a single word or a full
sentence — either way the whole line is treated as one learning unit, so a
5-word sentence stays grouped with its translation instead of being
interleaved with the next pair.

## Color modes

- **Language** — every Swedish focus letter is blue, every English focus
  letter is red.
- **Word** — each pair gets its own random color (shared by both the
  Swedish and English side of that pair).
- **Word (rainbow)** — same idea, but colors step through the rainbow in
  the order the pairs appear, instead of being random.

## Practice options

- **Practice mode** — *Flash* (RSVP) or *Multiple choice* (pick the right English
  for a Swedish prompt).
- **Session length** — full list once, or 1–5 minutes of the same words repeating
  in random order.
- **Swedish hint above** (Flash, toggle in the reader) — shows the Swedish
  word/sentence small above the English word instead of flashing it as its own
  big word, so the English gets the screen time.

## Local development

```bash
npm install
npm run dev
```

## Building for the web

```bash
npm run build
```

Output goes to `dist/`.

## Exporting as an iOS project (Capacitor)

This app is set up for [Capacitor](https://capacitorjs.com/), which wraps
the built web app in a real Xcode project.

Adding the `ios/` platform and building it requires **macOS with Xcode and
CocoaPods installed** — that step can't be run from Windows. On a Mac:

```bash
npm install
npm run build
npx cap add ios      # generates the ios/ Xcode project (first time only)
npx cap open ios     # opens it in Xcode to run on a simulator/device
```

After any change to the web app, sync it into the native project with:

```bash
npm run cap:sync
```

`ios/` is currently git-ignored since it's generated output; once you've
run `cap add ios` on a Mac, remove that line from `.gitignore` if you want
to commit the native project (recommended once you start customizing
native settings like the app icon or signing).
