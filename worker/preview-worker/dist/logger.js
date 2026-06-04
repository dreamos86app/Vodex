const SECRET_RE = /(SUPABASE_SERVICE_ROLE|SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY|sk_live|sk_test)[^\s]*/gi;
export function redactSecrets(text) {
    return text.replace(SECRET_RE, "[redacted]");
}
export function log(level, msg, extra) {
    const line = { ts: new Date().toISOString(), level, msg, ...extra };
    const out = JSON.stringify(line);
    if (level === "error")
        console.error(out);
    else if (level === "warn")
        console.warn(out);
    else
        console.log(out);
}
