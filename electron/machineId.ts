import crypto from "crypto";
import Store from "electron-store";

const store = new Store<{ id: string }>({
  name: "xspace-machine",
  defaults: { id: "" },
});

/** Stable random id (36 chars UUID) — satisfies typical MACHINE_ID_MIN_LENGTH. */
export function getOrCreateMachineId(): string {
  let id = store.get("id");
  if (!id || id.length < 16) {
    id = crypto.randomUUID();
    store.set("id", id);
  }
  return id;
}
