import React, { useEffect, useRef, useState } from "react";
import { createClient } from "graphql-ws";

type Message = {
  id: string;
  user: string;
  text: string;
  createdAt: string;
};

const GRAPHQL_HTTP = "http://localhost:4000/graphql";
const GRAPHQL_WS = "ws://localhost:4000/graphql";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<string>(
    () => "User" + Math.floor(Math.random() * 1000)
  );
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const fetchMessages = async () => {
    const q = `query { messages { id user text createdAt } }`;
    const res = await fetch(GRAPHQL_HTTP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    });
    const json = await res.json();
    if (json?.data?.messages) setMessages(json.data.messages);
  };

  useEffect(() => {
    fetchMessages();
    const client = createClient({ url: GRAPHQL_WS });

    const unsubscribe = client.subscribe(
      {
        query: `subscription { messagePosted { id user text createdAt } }`,
      },
      {
        next: (data: any) => {
          if (data?.data?.messagePosted) {
            setMessages((prev) => [...prev, data.data.messagePosted]);
          }
        },
        error: (err) => console.error("WS error", err),
        complete: () => console.log("WS complete"),
      }
    );

    return () => {
      unsubscribe();
      client.dispose();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    const mutation = `
      mutation Post($user: String!, $text: String!) {
        postMessage(user: $user, text: $text) {
          id user text createdAt
        }
      }`;
    await fetch(GRAPHQL_HTTP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutation, variables: { user, text } }),
    });
    setText("");
    fetchMessages();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4 text-white">
      <div className="max-w-lg w-full bg-gray-900 rounded-2xl shadow-lg flex flex-col overflow-hidden">
        <header className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Realtime Chat</h1>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="bg-gray-800 text-sm px-2 py-1 rounded border border-gray-600 focus:outline-none"
          />
        </header>

        <main className="p-4 space-y-4 overflow-y-auto h-96">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${
                m.user === user ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 shadow
                  ${m.user === user ? "bg-indigo-600 text-white" : "bg-gray-700"}`}
              >
                <div className="text-xs text-gray-300 mb-1">
                  {m.user} - {new Date(m.createdAt).toLocaleTimeString()}
                </div>
                <div className="text-sm">{m.text}</div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </main>

        <footer className="flex items-center gap-2 p-4 bg-gray-800">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message…"
            className="flex-1 rounded-full bg-gray-700 px-4 py-2 focus:outline-none"
          />
          <button
            onClick={sendMessage}
            className="bg-indigo-600 hover:bg-indigo-700 px-5 py-2 rounded-full font-semibold"
          >
            Send
          </button>
        </footer>
      </div>
    </div>
  );
}
