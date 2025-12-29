export function getPwnedMode(): "fail_closed" | "fail_open" {
  const v = (process.env.PWNED_PASSWORDS_MODE || "fail_closed").toLowerCase();
  return v === "fail_open" ? "fail_open" : "fail_closed";
}
