import "./shared/langs.js"; // globalThis.RC_LANGS
const name = (c) => globalThis.RC_LANGS.en(c);

export function isSentence(query) {
  return query.length > 60 || query.trim().split(/\s+/).length > 6;
}

// The input can be in langA or langB; the model determines the direction itself.
export function buildPrompt(query, langA, langB) {
  const A = name(langA);
  const B = name(langB);
  const sentence = isSentence(query);
  const shape = sentence
    ? `{"from":"<code>","to":"<code>","translations":[{"text":"...","pos":""}],"examples":[],"notes":""}`
    : `{"from":"<code>","to":"<code>","translations":[{"text":"...","pos":"noun|verb|adj|adv|phrase|..."}],"examples":[{"src":"...","tgt":"..."}],"notes":"..."}`;

  return [
    `You are a bilingual dictionary and translation engine for ${A} and ${B}.`,
    `The user input is either ${A} or ${B}. Detect which one, and translate into the other language.`,
    `"from" and "to" are exactly these language codes: "${langA}" or "${langB}".`,
    sentence
      ? `The input is a sentence or long phrase: give 1 to 3 natural translations, leave "examples" empty, "notes" empty.`
      : [
          `The input is a word or short phrase: give up to 6 translations ordered from most to least common, each with its part of speech.`,
          `Give exactly 3 natural example sentences that use the input (in the SOURCE language) with the matching translation (in the TARGET language). Wrap the input word (or its inflected form) and its counterpart in the translation with ** markers, e.g. "I **booked** a room." / "Bir oda **ayırttım**." (English / Turkish).`,
          `"notes": one short sentence (in ${B}) about meaning or usage if useful, otherwise an empty string.`
        ].join(" "),
    `Reply with JSON only, no markdown, exactly this shape: ${shape}`,
    `Input: ${JSON.stringify(query)}`
  ].join("\n");
}

export function parseModelJson(text) {
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model JSON döndürmedi");
  const obj = JSON.parse(t.slice(start, end + 1));
  return {
    from: obj.from || "",
    to: obj.to || "",
    translations: Array.isArray(obj.translations) ? obj.translations.filter((x) => x && x.text) : [],
    examples: Array.isArray(obj.examples) ? obj.examples.filter((x) => x && x.src && x.tgt) : [],
    notes: typeof obj.notes === "string" ? obj.notes : ""
  };
}
