import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f766e",
          position: "relative",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            width: 98,
            height: 98,
            borderRadius: 999,
            border: "8px solid white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 24,
            top: 40,
            width: 8,
            height: 68,
            borderRadius: 999,
            background: "white",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 20,
            top: 28,
            width: 3,
            height: 20,
            borderRadius: 999,
            background: "white",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 25,
            top: 28,
            width: 3,
            height: 20,
            borderRadius: 999,
            background: "white",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 30,
            top: 28,
            width: 3,
            height: 20,
            borderRadius: 999,
            background: "white",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 24,
            top: 28,
            width: 16,
            height: 34,
            borderRadius: "50% 50% 42% 42%",
            border: "6px solid white",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 30,
            top: 58,
            width: 6,
            height: 50,
            borderRadius: 999,
            background: "white",
          }}
        />
      </div>
    ),
    size,
  );
}
