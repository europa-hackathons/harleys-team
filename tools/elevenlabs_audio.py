"""Make a sound effect or a music loop with the ElevenLabs API and save it to assets/audio/.

Usage (from the repo root):
  python tools/elevenlabs_audio.py sfx   --prompt "short laser blast" --name laser --seconds 1
  python tools/elevenlabs_audio.py sfx   --prompt "gentle wind" --name wind --seconds 8 --loop
  python tools/elevenlabs_audio.py music --prompt "driving synthwave space adventure" --name theme --seconds 30

Sound effects: 0.5-30 s, model eleven_text_to_sound_v3. --loop asks for a seamless loop.
Music: 3-120 s here (the API allows more; game loops don't need it), model music_v2_5, always
instrumental (no lyrics, so nothing unexpected gets sung).

Kid-safe guardrails (the Grown-up's rules). Out of bounds: real spoken words (speech, narration,
lyrics), horror, death and gore, and rude bodily sounds. Everything else is fine: lasers, explosions,
crowds, laughing, and characters making wordless Sims-style greetings and exclamations. A prompt with
a blocked word is refused before any credits are spent: exit code 2 and one JSON line with
"refused": true, the "blocked" words, a few close "options" and a "for_grown_up" line, also appended
to assets/audio/_refused.jsonl (git-ignored) for the Grown-up to review. Prompts asking for a voice
get a line asking for non-verbal noises only, and anything about a voice or a creature goes through
speech-to-text: if it hears
real words, the sound is held back in assets/audio/_old/ and refused the same way. Music is always
forced instrumental. The Grown-up can still listen to anything: the model can slip. Check the word list with: python tools/elevenlabs_audio.py --self-test

Never overwrites silently: if assets/audio/<name>.mp3 exists, the old file is moved to
assets/audio/_old/<name>-<time>.mp3 (git-ignored) so the previous version can be put back.

Reads the key from ELEVENLABS_API_KEY; on Windows it also checks the user and machine
environment in the registry, so a key set after the terminal opened still works.
Prints one JSON line with the result, including the credits the request cost.
"""
import argparse, json, os, re, shutil, sys, time, urllib.error, urllib.request, uuid

API = "https://api.elevenlabs.io/v1"
SFX_MODEL = "eleven_text_to_sound_v3"
MUSIC_MODEL = "music_v2_5"
STT_MODEL = "scribe_v1"   # checks character sounds for real words
FORMAT = "mp3_44100_128"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT_DIR = os.path.join(ROOT, "assets", "audio")
OLD_DIR = os.path.join(OUT_DIR, "_old")

# Refused themes: whole words (and their -s/-ing/-ed forms) that get a prompt refused, each with a few
# neutral, close-in-spirit options. Only four things are out: real spoken words, horror, death and
# gore, and rude bodily sounds. Everything else is fine, including lasers, explosions, blasters, crowds,
# laughing, and characters making wordless Sims-style greetings and exclamations.
# Every option must itself pass the check: python tools/elevenlabs_audio.py --self-test
THEMES = {
    "spoken words": (["speech", "speak", "spoken", "talk", "say", "said", "word", "words", "sentence", "whisper",
                      "narrator", "narration", "announcer", "dialogue", "conversation", "lyric", "lyrics",
                      "sing", "singer", "singing", "rap"],
                     ["wordless gibberish greeting, like a video game character",
                      "wordless exclamation, like a video game character", "the melody played on an instrument"]),
    "death and gore": (["death", "die", "dying", "dead", "kill", "murder", "corpse", "blood", "bloody", "gore",
                        "bleed", "wound", "stab", "pain", "agony"],
                       ["defeat sound", "explosion", "power-down sound", "wordless 'oof' when hit"]),
    "horror": (["horror", "creepy", "terror", "terrifying", "zombie", "demon", "haunted", "scream", "shriek",
                "wail"],
               ["tense, mysterious atmosphere", "suspenseful low drone", "wordless surprised exclamation"]),
    "rude or bodily sounds": (["fart", "burp", "belch", "flatulence", "poop", "poo", "pee", "wee", "toilet",
                               "vomit", "puke", "barf", "snot", "spit", "butt", "sexy"],
                              ["squelch", "splat", "pop"]),
}
BLOCKED = {word: theme for theme, (words, _) in THEMES.items() for word in words}
# Characters may make wordless sounds. Prompts that ask for a voice get CHARACTER_SUFFIX and a speech-to-text
# check; prompts that only name a creature (a monster growl, a robot whirr) get the check but not the suffix,
# because the model follows the suffix literally and adds hums and "ooh"s nobody asked for.
VOICE_WORDS = {"voice", "vocal", "person", "people", "man", "woman", "kid", "kids", "child", "baby", "boy",
               "girl", "crowd", "greeting", "greet", "exclamation", "exclaim", "gibberish", "babble", "laugh",
               "laughing", "giggle", "cheer", "cheering", "shout", "yell", "cry", "grunt", "hum", "humming",
               "oof", "yay", "hey", "hello", "whoa", "woo"}
CREATURE_WORDS = {"character", "creature", "alien", "monster", "robot", "enemy", "baddie", "boss", "hero",
                  "player", "animal", "dragon", "goblin", "troll", "giant", "ghost"}
SFX_SUFFIX = ". Sound effect for a family-friendly video game."
# Tested: this wording gave no real words in 3 of 3 voice samples; "wordless gibberish" still said "Hello".
CHARACTER_SUFFIX = " The character makes only non-verbal vocal noises (hums, gasps, giggles, 'ooh', 'hmm'), no talking."
# Exclamations speech-to-text writes down as words but that are fine (Sims-style, no meaning).
INTERJECTIONS = {"oh", "ooh", "oo", "ah", "aah", "ahh", "ohh", "aw", "aww", "uh", "um", "hm", "hmm", "mm", "huh",
                 "ha", "hah", "haha", "heh", "hehe", "hee", "ho", "hoo", "woo", "woohoo", "wahoo", "yahoo", "yay",
                 "whoa", "woah", "wow", "oops", "whoops", "eek", "ow", "ouch", "oof", "ugh", "phew", "aha", "wa",
                 "wah", "whee", "hup", "boing"}
MUSIC_SUFFIX = " Instrumental only, for a family-friendly video game."
REFUSED_LOG = os.path.join(OUT_DIR, "_refused.jsonl")   # git-ignored; the Grown-up reviews it


def forms(word):
    """The word and its plain stems: dies -> die, screaming -> scream, cried -> cry."""
    out = {word}
    for end, back in (("s", ""), ("es", ""), ("ies", "y"), ("ied", "y"), ("d", ""), ("ed", ""), ("ing", ""), ("ing", "e")):
        if word.endswith(end) and len(word) > len(end) + 1:
            out.add(word[: -len(end)] + back)
    return out


def blocked_words(prompt):
    """Words in the prompt that hit the list, as {word as written: theme}."""
    return {w: BLOCKED[f] for w in re.findall(r"[a-z]+", prompt.lower()) for f in forms(w) if f in BLOCKED}


def mentions(prompt, words):
    return any(forms(w) & words for w in re.findall(r"[a-z]+", prompt.lower()))


def about_character(prompt):
    """Anything that might come out with a voice: checked with speech-to-text after it's made."""
    return mentions(prompt, VOICE_WORDS | CREATURE_WORDS)


def sfx_prompt(prompt):
    """The prompt as sent: plus the family-friendly suffix, and the wordless-voice line if it asks for a voice."""
    return (prompt.rstrip().rstrip(".!") + SFX_SUFFIX
            + (CHARACTER_SUFFIX if mentions(prompt, VOICE_WORDS) else ""))


def refuse(entry, message):
    """Log a refusal for the Grown-up, print it as the JSON result, and exit 2."""
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(REFUSED_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
    print(json.dumps(entry))
    print(message, file=sys.stderr)
    sys.exit(2)


def check_prompt(prompt, kind="sfx"):
    """Refuse (exit 2) a prompt with blocked words: log it for the Grown-up and list close options."""
    hits = blocked_words(prompt)
    if not hits:
        return
    themes = list(dict.fromkeys(hits.values()))
    entry = {
        "refused": True,
        "time": time.strftime("%Y-%m-%d %H:%M"),
        "kind": kind,
        "prompt": prompt,
        "blocked": sorted(hits),
        "themes": themes,
        "options": [o for t in themes for o in THEMES[t][1]],
        "for_grown_up": f"Sound refused, nothing spent: \"{prompt}\" (blocked: {', '.join(sorted(hits))}; "
                        f"{', '.join(themes)}). Logged in assets/audio/_refused.jsonl.",
    }
    refuse(entry, f"Refused, nothing spent: {', '.join(sorted(hits))} ({', '.join(themes)}). Out of bounds: real "
                  f"spoken words, horror, death and gore, rude bodily sounds. Close options: {'; '.join(entry['options'])}.")


def heard_words(audio, key):
    """Real words speech-to-text hears in the audio (wordless noises come back as audio events, not words)."""
    boundary = uuid.uuid4().hex
    body = b""
    for field, value in (("model_id", STT_MODEL), ("tag_audio_events", "true")):
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"\r\n\r\n{value}\r\n'.encode()
    body += (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="sound.mp3"\r\n'
             f"Content-Type: audio/mpeg\r\n\r\n").encode() + audio + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"{API}/speech-to-text", data=body, method="POST",
                                 headers={"xi-api-key": key, "Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            result = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs speech-to-text failed (sound not saved): HTTP {e.code} {e.read().decode(errors='replace')[:500]}")
    return real_words(w["text"] for w in result.get("words", []) if w.get("type") == "word")


def real_words(tokens):
    """Drop what isn't a real word: punctuation, exclamations ('Woo!', 'Ooooh'), and the single kana or hanzi
    speech-to-text uses for a vocal noise ('お', '哇'). Unknown made-up words stay in: better held back than missed."""
    out = []
    for t in tokens:
        letters = re.sub(r"[\W\d_]", "", t.lower())
        if not letters:
            continue
        if not re.search(r"[a-z]", letters) and len(letters) <= 2:
            continue
        squeezed = re.sub(r"(.)\1{2,}", r"\1\1", letters)   # woooo -> woo, hmmmm -> hmm
        if {letters, squeezed, re.sub(r"(.)\1+", r"\1", letters)} & INTERJECTIONS:
            continue
        out.append(t)
    return out


def self_test():
    for theme, (_, options) in THEMES.items():
        for o in options:
            assert not blocked_words(o), f"option for {theme} is itself blocked: {o!r} {blocked_words(o)}"
    for p in ["robot says hello", "narrator talking", "monster dies", "the hero died", "blood splatter",
              "zombie moaning in a haunted house", "screaming ghost", "farting", "singing a song with lyrics"]:
        assert blocked_words(p), p
    for p in ["big laser blast", "spaceship explosion", "blaster pew pew", "crowd cheering", "kids laughing",
              "monster roar", "boss defeated, huge explosion", "cute alien gibberish greeting", "goat bleat",
              "happy adventure song", "racing car engine with siren", "sword clash"]:
        assert not blocked_words(p), (p, blocked_words(p))
    assert sfx_prompt("laser zap.") == "laser zap" + SFX_SUFFIX
    assert sfx_prompt("cute alien greeting").endswith(CHARACTER_SUFFIX)
    assert sfx_prompt("low rumbly monster growl").endswith(SFX_SUFFIX)   # creature: checked, but no voice line
    assert about_character("low rumbly monster growl") and about_character("crowd cheering")
    assert not about_character("tank treads rumbling")
    assert real_words(["Woo!", "Ooooh.", "Hmmm", "お", "哇", "...", "Yay!"]) == []
    assert real_words(["Hello?", "Welcome", "Magadaba"]) == ["Hello?", "Welcome", "Magadaba"]
    print("self-test ok")


def find_key():
    """The ElevenLabs key, or None. Also used by tools/doctor.py."""
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key and sys.platform == "win32":
        import winreg
        for hive, path in ((winreg.HKEY_CURRENT_USER, "Environment"),
                           (winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment")):
            try:
                with winreg.OpenKey(hive, path) as k:
                    key = winreg.QueryValueEx(k, "ELEVENLABS_API_KEY")[0]
                    break
            except OSError:
                pass
    return key.strip() if key else None


def api_key():
    key = find_key()
    if not key:
        sys.exit("No ELEVENLABS_API_KEY found. Sounds are off on this machine: see docs/agents/environment.md.")
    return key


def post(path, body, key, timeout):
    req = urllib.request.Request(f"{API}{path}?output_format={FORMAT}", data=json.dumps(body).encode(), method="POST",
                                 headers={"xi-api-key": key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read(), r.headers.get("character-cost")
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:800]
        sys.exit(f"ElevenLabs POST {path} failed: HTTP {e.code} {detail}")


def main():
    for stream in (sys.stdout, sys.stderr):   # heard words can be in any script; never crash printing them
        stream.reconfigure(errors="replace")
    if sys.argv[1:] == ["--self-test"]:
        return self_test()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("kind", choices=["sfx", "music"])
    ap.add_argument("--prompt", required=True, help="what it should sound like")
    ap.add_argument("--name", required=True, help="file name in assets/audio, without .mp3 (a-z, 0-9, -)")
    ap.add_argument("--seconds", type=float, help="length (sfx 0.5-30, default: model picks; music 3-120, default 30)")
    ap.add_argument("--loop", action="store_true", help="sfx only: make it loop seamlessly")
    ap.add_argument("--influence", type=float, default=0.5, help="sfx only: how closely to follow the prompt, 0-1")
    a = ap.parse_args()

    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", a.name):
        sys.exit("--name must be lowercase letters, digits and dashes, e.g. coin-pickup")
    if not os.path.isfile(os.path.join(ROOT, ".team-machine")):
        sys.exit("Sounds and music are only available on the original team's machine (see docs/agents/environment.md). "
                 "Simple beeps made in code are fine instead.")
    check_prompt(a.prompt, a.kind)
    key = api_key()
    started = time.time()

    if a.kind == "sfx":
        if a.seconds is not None and not 0.5 <= a.seconds <= 30:
            sys.exit("sfx --seconds must be between 0.5 and 30")
        body = {"text": sfx_prompt(a.prompt), "model_id": SFX_MODEL, "prompt_influence": a.influence, "loop": a.loop}
        if a.seconds is not None:
            body["duration_seconds"] = a.seconds
        audio, cost = post("/sound-generation", body, key, timeout=120)
    else:
        seconds = a.seconds or 30
        if not 3 <= seconds <= 120:
            sys.exit("music --seconds must be between 3 and 120")
        body = {"prompt": a.prompt.rstrip() + MUSIC_SUFFIX, "music_length_ms": int(seconds * 1000), "model_id": MUSIC_MODEL,
                "force_instrumental": True}
        print(f"music: composing {seconds:g} s, this can take a minute...", file=sys.stderr)
        audio, cost = post("/music", body, key, timeout=300)

    if len(audio) < 1000:
        sys.exit(f"ElevenLabs returned only {len(audio)} bytes: {audio[:300]!r}")

    if a.kind == "sfx" and about_character(a.prompt):   # characters may only make wordless sounds
        words = heard_words(audio, key)
        if words:
            os.makedirs(OLD_DIR, exist_ok=True)
            held = os.path.join(OLD_DIR, f"{a.name}-had-words-{time.strftime('%Y%m%d-%H%M%S')}.mp3")
            with open(held, "wb") as f:
                f.write(audio)
            held_path = os.path.abspath(held)   # absolute, so the Grown-up Note can link it directly
            held = os.path.relpath(held, ROOT).replace(os.sep, "/")
            said = " ".join(words)
            refuse({"refused": True, "time": time.strftime("%Y-%m-%d %H:%M"), "kind": a.kind, "prompt": a.prompt,
                    "heard": words, "held_back": held, "path": held_path,
                    "options": ["try again (results vary)", "describe the sound without the character"],
                    "for_grown_up": f'Sound held back: speech-to-text heard real words ("{said}") in "{a.prompt}". '
                                    "Not in the game; listen via the path."},
                   f'Held back: the sound has real words in it ("{said}"). Saved at {held}, not in the game.')

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"{a.name}.mp3")
    backup = None
    if os.path.exists(out):
        os.makedirs(OLD_DIR, exist_ok=True)
        backup = os.path.join(OLD_DIR, f"{a.name}-{time.strftime('%Y%m%d-%H%M%S')}.mp3")
        shutil.move(out, backup)
    with open(out, "wb") as f:
        f.write(audio)

    print(json.dumps({
        "file": f"assets/audio/{a.name}.mp3",
        "path": os.path.abspath(out),   # absolute, so the Grown-up Note can link it directly
        "kind": a.kind,
        "bytes": len(audio),
        "credits": int(cost) if cost and cost.isdigit() else cost,
        "seconds_taken": round(time.time() - started, 1),
        "previous_version": os.path.relpath(backup, ROOT).replace("\\", "/") if backup else None,
    }))


if __name__ == "__main__":
    main()
