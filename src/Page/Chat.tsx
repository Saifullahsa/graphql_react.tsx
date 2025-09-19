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
  const [user, setUser] = useState(() => "User" + Math.floor(Math.random() * 1000));
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    const div = document.createElement("div");
    div.className =
      "fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg animate-fade";
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
  };

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

    const unsubscribeNew = client.subscribe(
      { query: `subscription { messagePosted { id user text createdAt } }` },
      {
        next: (data) => {
          const m = (data as any)?.data?.messagePosted;
          if (m) {
            setMessages((prev) => [...prev, m]);
            showToast(`New message from ${m.user}: ${m.text}`);
          }
        },
        error: (err) => console.error("WS error (new)", err),
        complete: () => console.log("WS complete (new)"),
      }
    );

    const unsubscribeUpdate = client.subscribe(
      { query: `subscription { messageUpdated { id user text createdAt } }` },
      {
        next: (data) => {
          const m = (data as any)?.data?.messageUpdated;
          if (m) {
            setMessages((prev) => 
              prev.map(msg => msg.id === m.id ? m : msg)
            );
            showToast(`Message updated by ${m.user}`);
          }
        },
        error: (err) => console.error("WS error (update)", err),
        complete: () => console.log("WS complete (update)"),
      }
    );

    const unsubscribeDelete = client.subscribe(
      { query: `subscription { messageDeleted { id success } }` },
      {
        next: (data) => {
          const deleteData = (data as any)?.data?.messageDeleted;
          if (deleteData && deleteData.success) {
            setMessages((prev) => 
              prev.filter(msg => msg.id !== deleteData.id)
            );
            showToast(`Message deleted`);
          }
        },
        error: (err) => console.error("WS error (delete)", err),
        complete: () => console.log("WS complete (delete)"),
      }
    );

    return () => {
      unsubscribeNew();
      unsubscribeUpdate();
      unsubscribeDelete();
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
        postMessage(user: $user, text: $text) { id user text createdAt }
      }`;
    await fetch(GRAPHQL_HTTP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutation, variables: { user, text } }),
    });
    setText("");
    fetchMessages();
  };

  const saveEdit = async (id: string) => {
    if (!editingText.trim()) return;
    const mutation = `
      mutation Update($id: ID!, $text: String!) {
        updateMessage(id: $id, text: $text) { id user text createdAt }
      }`;
    await fetch(GRAPHQL_HTTP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutation, variables: { id, text: editingText } }),
    });
    setEditingId(null);
    setEditingText("");
    fetchMessages();
  };

  const deleteMessage = async (id: string) => {
    const mutation = `
      mutation Delete($id: ID!) {
        deleteMessage(id: $id) { id success }
      }`;
    await fetch(GRAPHQL_HTTP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: mutation, variables: { id } }),
    });
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
          {messages.map((m) => {
            const isOwn = m.user === user;
            return (
              <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 shadow relative
                    ${isOwn ? "bg-indigo-600 text-white" : "bg-gray-700"}`}
                >
                  <div className="text-xs text-gray-300 mb-1 flex justify-between items-center">
                    <span>
                      {m.user} - {new Date(m.createdAt).toLocaleTimeString()}
                    </span>
                    {isOwn && (
                      <span className="ml-2 space-x-1">
                        <button
                          onClick={() => {
                            setEditingId(m.id);
                            setEditingText(m.text);
                          }}
                          className="text-xs bg-green-600 rounded-sm px-1 text-white hover:bg-green-400"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMessage(m.id)}
                          className="text-xs text-white bg-red-600 rounded-sm px-1 hover:bg-red-400"
                        >
                          Delete
                        </button>
                      </span>
                    )}
                  </div>

                  {editingId === m.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        className="flex-1 rounded bg-gray-800 px-2 py-1 text-sm focus:outline-none"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                      />
                      <button
                        onClick={() => saveEdit(m.id)}
                        className="text-xs bg-green-600 px-2 py-1 rounded hover:bg-green-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs bg-gray-600 px-2 py-1 rounded hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm">{m.text}</div>
                  )}
                </div>
              </div>
            );
          })}
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