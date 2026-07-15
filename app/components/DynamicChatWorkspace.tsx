"use client";

import dynamic from "next/dynamic";

const ChatWorkspace = dynamic(() => import("./ChatWorkspace"), {
  ssr: false,
});

export default ChatWorkspace;
