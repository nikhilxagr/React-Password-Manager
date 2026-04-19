const SYMBOLS = "!@#$%^&*()-_=+[]{}<>?";
const NUMBERS = "0123456789";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const pick = (chars) => chars[Math.floor(Math.random() * chars.length)];

const shuffle = (text) => {
  const array = text.split("");
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array.join("");
};

export const generateStrongPassword = (length = 16) => {
  const safeLength = Math.max(12, Math.min(length, 32));
  const all = `${LOWER}${UPPER}${NUMBERS}${SYMBOLS}`;

  let output = `${pick(LOWER)}${pick(UPPER)}${pick(NUMBERS)}${pick(SYMBOLS)}`;

  while (output.length < safeLength) {
    output += pick(all);
  }

  return shuffle(output);
};

export const estimateStrength = (password) => {
  if (!password) {
    return { score: 0, label: "Empty", percent: 0 };
  }

  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const levels = [
    { label: "Very weak", percent: 12 },
    { label: "Weak", percent: 28 },
    { label: "Fair", percent: 45 },
    { label: "Good", percent: 65 },
    { label: "Strong", percent: 82 },
    { label: "Excellent", percent: 100 },
  ];

  return {
    score,
    label: levels[score].label,
    percent: levels[score].percent,
  };
};
