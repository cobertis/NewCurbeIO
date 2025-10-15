export default (ctx) => ({
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
  from: ctx.from || undefined,
})
