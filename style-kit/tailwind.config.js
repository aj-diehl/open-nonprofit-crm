const withOpacityValue = (variable) => {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgb(var(${variable}) / ${opacityValue})`;
    }
    return `rgb(var(${variable}))`;
  };
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,jsx,ts,tsx,mdx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx,mdx}",
    "./src/**/*.{js,jsx,ts,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: withOpacityValue("--foreground-rgb"),
        primary: {"DEFAULT":"var(--primary)","foreground":"var(--primary-foreground)"},
        secondary: {"DEFAULT":"var(--secondary)","foreground":"var(--secondary-foreground)"},
        accent: {"DEFAULT":"var(--accent)","foreground":"var(--accent-foreground)"},
        muted: "var(--muted)",
        ring: "var(--ring)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
      },
      borderRadius: {
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-pill)"
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        brand1: "var(--elev-1)",
        brand2: "var(--elev-2)",
        brand3: "var(--elev-3)"
      },
      transitionTimingFunction: {
        brand: "var(--ease-brand)"
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        base: "var(--duration-base)"
      }
    }
  },
  plugins: []
};
