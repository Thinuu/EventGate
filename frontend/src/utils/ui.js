export const confirmDelete = async (label, action) => {
  if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
  await action();
};

export const safeArray = (arr) => arr ?? [];
