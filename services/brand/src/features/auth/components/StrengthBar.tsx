export interface PasswordStrength {
  score: number;
  label: string;
  tone: "empty" | "weak" | "fair" | "good" | "strong";
  colorClass: string;
  requirements: {
    label: string;
    met: boolean;
  }[];
}

export const getPasswordStrength = (password: string): PasswordStrength => {
  const requirements = [
    { label: "8+ characters", met: password.length >= 8 },
    {
      label: "Upper and lowercase",
      met: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    { label: "Number", met: /\d/.test(password) },
    { label: "Symbol", met: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = password ? requirements.filter((requirement) => requirement.met).length : 0;

  if (!password) {
    return {
      score,
      label: "ENTER A PASSWORD",
      tone: "empty",
      colorClass: "bg-slate-300",
      requirements,
    };
  }

  if (score <= 1) {
    return {
      score,
      label: "WEAK",
      tone: "weak",
      colorClass: "bg-red-500",
      requirements,
    };
  }

  if (score === 2) {
    return {
      score,
      label: "FAIR",
      tone: "fair",
      colorClass: "bg-amber-500",
      requirements,
    };
  }

  if (score === 3) {
    return {
      score,
      label: "STRONG",
      tone: "strong",
      colorClass: "bg-[#001BD2]",
      requirements,
    };
  }

  return {
    score,
    label: "VERY STRONG",
    tone: "strong",
    colorClass: "bg-emerald-500",
    requirements,
  };
};

interface StrengthBarProps {
  password: string;
}

export default function StrengthBar({ password }: StrengthBarProps) {
  const strength = getPasswordStrength(password);

  return (
    <div className="w-full flex flex-col gap-2 font-manrope">
      <div className="flex gap-1.5 w-full">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full transition-colors ${
              index < strength.score ? strength.colorClass : "bg-[#1971d9]/20"
            }`}
          />
        ))}
      </div>

      <div
        className={`flex flex-col gap-1 text-[10px] font-extrabold tracking-wider ${
          strength.tone === "weak"
            ? "text-red-600"
            : strength.tone === "fair"
              ? "text-amber-600"
              : strength.tone === "strong"
                ? "text-emerald-600"
                : "text-[#001BD2]"
        }`}
        aria-live="polite"
      >
        <span>PASSWORD STRENGTH: {strength.label}</span>
        {password && strength.score < 4 && (
          <span className="text-[#757688]">
            ADD{" "}
            {strength.requirements
              .filter((requirement) => !requirement.met)
              .map((requirement) => requirement.label)
              .join(", ")}
          </span>
        )}
      </div>
    </div>
  );
}
