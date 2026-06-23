export function getRoleAttr(role, key) {
  if (!key) return undefined;

  // 如果属性是嵌套属性（例如 equipments.0 或 elementalResistance.1）
  if (key.includes('.')) {
    const parts = key.split('.');
    let cur = role;

    for (const part of parts) {
      if (cur === undefined || cur === null) return undefined;
      const parsed = isNaN(part) ? part : parseInt(part, 10);
      cur = cur[parsed];
    }

    return cur;
  }

  return role[key];
}

export function setRoleAttr(role, key, value) {
  if (!key) return;

  // 如果属性是嵌套属性（例如 equipments.0 或 elementalResistance.1）
  if (key.includes('.')) {
    const parts = key.split('.');
    let cur = role;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const parsed = isNaN(part) ? part : parseInt(part, 10);
      const nextPart = parts[i + 1];

      if (cur[parsed] === undefined) {
        cur[parsed] = isNaN(nextPart) ? {} : [];
      }

      cur = cur[parsed];
    }

    const lastPart = parts[parts.length - 1];
    const parsedLast = isNaN(lastPart) ? lastPart : parseInt(lastPart, 10);
    cur[parsedLast] = value;
  } else {
    role[key] = value;
  }
}
