import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RustControl",
    short_name: "RustControl",
    description:
      "A personal Rust companion for servers and players you follow.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0b0b",
    theme_color: "#0d0b0b",
    icons: [
      {
        src: "/icons/rustcontrol.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  }
}
