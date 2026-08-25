import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const origin = "https://student.bennetterp.camu.in";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139.0.0.0 Safari/537.36";

const page = await fetch(origin + "/", { headers: { "User-Agent": UA }, redirect: "manual" });
const pre = [].concat(page.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]);
const lr = await fetch(origin + "/login/validate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json", Accept: "application/json",
    appVersion: "v2", clientTzOfst: "-330", "X-App-Type": "student",
    "User-Agent": UA, Cookie: pre.join("; "),
  },
  body: JSON.stringify({ InId: env.CAMU_INSTITUTION_ID, Email: env.CAMU_EMAIL, pwd: env.CAMU_PASSWORD }),
});
const lc = [].concat(lr.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]);
const menu = await (await fetch(origin + "/api/mess-management/get-student-menu-list", {
  method: "POST",
  headers: {
    "Content-Type": "application/json", Accept: "application/json",
    appVersion: "v2", clientTzOfst: "-330", Cookie: lc.join("; "), "User-Agent": UA,
  },
  body: "{}",
})).json();

for (const m of menu.output.data.oMealList) {
  const codes = [...m.mealTm].filter((ch) => ch.charCodeAt(0) > 126).map((ch) => "U+" + ch.charCodeAt(0).toString(16));
  console.log(JSON.stringify(m.msCde), "| mealTm chars:", JSON.stringify(m.mealTm), codes.length ? "NON-ASCII: " + codes.join(",") : "(ascii ok)");
}
console.log("srvSts values:", menu.output.data.oMealList.map((m) => m.srvSts + "@" + (m.srvDte ?? "-")).join(", "));
