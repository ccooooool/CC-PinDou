/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* NookUI 马卡龙色系 */
        nook: {
          cream: "#FFFBF0",
          paper: "#FFF8E7",
          wood: "#E6C9A8",
          brown: "#5D4037",
        },
        ac: {
          green: "#A8E6CF",
          "green-dark": "#7BC8A4",
          blue: "#A0D8EF",
          "blue-dark": "#7BBCD4",
          pink: "#FFB7C5",
          "pink-dark": "#E89AA8",
          yellow: "#FFF4BD",
          "yellow-dark": "#E8D99A",
          coral: "#FFAAA5",
          "coral-dark": "#E88A85",
          lavender: "#D4BBFF",
          "lavender-dark": "#B89AE8",
          mint: "#B5EAD7",
          peach: "#FFDAC1",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        nook: ["Nunito", "PingFang SC", "Microsoft YaHei", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
