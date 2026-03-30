import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(180deg, rgba(15,118,110,1) 0%, rgba(10,90,84,1) 100%)",
          position: "relative",
        }}
      >
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: 999,
            border: "20px solid white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 18px 40px rgba(0,0,0,0.16)",
          }}
        >
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 92,
            top: 120,
            width: 22,
            height: 190,
            borderRadius: 999,
            background: "white",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 82,
            top: 92,
            width: 8,
            height: 46,
            borderRadius: 999,
            background: "white",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 95,
            top: 92,
            width: 8,
            height: 46,
            borderRadius: 999,
            background: "white",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 108,
            top: 92,
            width: 8,
            height: 46,
            borderRadius: 999,
            background: "white",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 92,
            top: 92,
            width: 34,
            height: 92,
            borderRadius: "50% 50% 42% 42%",
            border: "14px solid white",
            borderBottomWidth: 18,
            borderTopWidth: 18,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 105,
            top: 170,
            width: 12,
            height: 138,
            borderRadius: 999,
            background: "white",
          }}
        />
      </div>
    ),
    size,
  );
}
