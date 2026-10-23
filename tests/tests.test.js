// tests.test.js — Pruebas unitarias reales (se ejecutan con node --test)
import { validateEmail, validatePassword, validateName, containsBannedWords, extractHashtags, extractMentions, validatePollOptions } from "../js/validators.js";
import { formatTime, formatDate, timeAgo, formatNumber, initials, isToday } from "../js/formatters.js";
import { esc, convId, debounce, truncate, chunk, unique, sortBy, clamp } from "../js/utils.js";
import assert from "node:assert/strict";
import { test } from "node:test";

test("validateEmail acepta correos válidos", () => {
  assert.equal(validateEmail("test@example.com"), true);
  assert.equal(validateEmail("a.b+c@sub.domain.co"), true);
});
test("validateEmail rechaza correos inválidos", () => {
  assert.equal(validateEmail(""), false);
  assert.equal(validateEmail("noarroba.com"), false);
  assert.equal(validateEmail("a@b"), false);
});
test("validatePassword mínimo 6", () => {
  assert.equal(validatePassword("123").ok, false);
  assert.equal(validatePassword("123456").ok, true);
});
test("validateName", () => {
  assert.equal(validateName("").ok, false);
  assert.equal(validateName("A").ok, false);
  assert.equal(validateName("Ana").ok, true);
});
test("containsBannedWords", () => {
  assert.equal(containsBannedWords("hola mundo", ["feo"]), false);
  assert.equal(containsBannedWords("eres feo", ["feo"]), true);
});
test("extractHashtags", () => {
  const tags = extractHashtags("Hola #mundo y #Inside");
  assert.deepEqual(tags, ["#mundo", "#inside"]);
});
test("extractMentions", () => {
  const m = extractMentions("Hola @ana y @juan");
  assert.deepEqual(m, ["ana", "juan"]);
});
test("validatePollOptions", () => {
  assert.equal(validatePollOptions(["a"]).ok, false);
  assert.equal(validatePollOptions(["a","b","a"]).ok, false);
  assert.equal(validatePollOptions(["a","b","c"]).ok, true);
});
test("esc escapa HTML", () => {
  assert.equal(esc("<script>"), "&lt;script&gt;");
});
test("convId ordena IDs", () => {
  assert.equal(convId("b", "a"), "a_b");
});
test("truncate", () => {
  assert.equal(truncate("hola mundo", 4), "hola…");
  assert.equal(truncate("hola", 10), "hola");
});
test("chunk divide arrays", () => {
  assert.deepEqual(chunk([1,2,3,4,5], 2), [[1,2],[3,4],[5]]);
});
test("unique elimina duplicados", () => {
  assert.deepEqual(unique([1,1,2,3,3]), [1,2,3]);
});
test("sortBy ordena", () => {
  assert.deepEqual(sortBy([{n:2},{n:1}], "n").map(x=>x.n), [1,2]);
});
test("clamp limita valores", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});
test("formatNumber abrevia", () => {
  assert.equal(formatNumber(1500), "1.5K");
  assert.equal(formatNumber(2000000), "2M");
});
test("initials extrae iniciales", () => {
  assert.equal(initials("Ana María"), "AM");
});
test("isToday reconoce hoy", () => {
  assert.equal(isToday(Date.now()), true);
});
test("timeAgo devuelve string", () => {
  assert.equal(typeof timeAgo(Date.now() - 1000), "string");
});
test("debounce agrupa llamadas", (t, done) => {
  let count = 0;
  const fn = debounce(() => count++, 10);
  fn(); fn(); fn();
  setTimeout(() => { assert.equal(count, 1); done(); }, 50);
});
