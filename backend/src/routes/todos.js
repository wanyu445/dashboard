const path = require("path");
const os = require("os");

const TODO_DB_PATH = path.join(os.homedir(), ".cyberboss", "data", "todos.sqlite");

function openDb() {
  const Database = require("better-sqlite3");
  const db = new Database(TODO_DB_PATH);
  db.pragma("journal_mode = WAL");
  return db;
}

function rowToTodo(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    completed: row.completedAt !== null,
    completedAt: row.completedAt,
    startedAt: row.startedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function todoRoutes(app) {
  app.get("/api/todos", async () => {
    const db = openDb();
    try {
      const rows = db.prepare("SELECT * FROM todos ORDER BY createdAt DESC").all();
      return { todos: rows.map(rowToTodo) };
    } finally {
      db.close();
    }
  });

  app.post("/api/todos", async (req) => {
    const { title, description } = req.body || {};
    if (!title || !String(title).trim()) {
      return { message: "title is required" };
    }
    const db = openDb();
    try {
      const crypto = require("crypto");
      const now = new Date().toISOString();
      const todo = {
        id: crypto.randomUUID(),
        title: String(title).trim(),
        description: String(description || "").trim(),
        completedAt: null,
        startedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      db.prepare(
        "INSERT INTO todos (id, title, description, completedAt, startedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(todo.id, todo.title, todo.description, todo.completedAt, todo.startedAt, todo.createdAt, todo.updatedAt);
      return { todo };
    } finally {
      db.close();
    }
  });

  app.patch("/api/todos/:id", async (req) => {
    const id = req.params.id;
    const { title, description, completed, startedAt } = req.body || {};
    const db = openDb();
    try {
      const row = db.prepare("SELECT * FROM todos WHERE id = ?").get(id);
      if (!row) return { message: "not found" };
      const now = new Date().toISOString();
      const newTitle = title !== undefined ? String(title).trim() : row.title;
      const newDesc = description !== undefined ? String(description).trim() : row.description;
      const newStartedAt = startedAt !== undefined ? (startedAt || null) : row.startedAt;
      const newCompletedAt = completed === true ? now : (completed === false ? null : row.completedAt);
      db.prepare(
        "UPDATE todos SET title = ?, description = ?, completedAt = ?, startedAt = ?, updatedAt = ? WHERE id = ?"
      ).run(newTitle, newDesc, newCompletedAt, newStartedAt, now, id);
      return { todo: rowToTodo(db.prepare("SELECT * FROM todos WHERE id = ?").get(id)) };
    } finally {
      db.close();
    }
  });

  app.delete("/api/todos/:id", async (req) => {
    const db = openDb();
    try {
      db.prepare("DELETE FROM todos WHERE id = ?").run(req.params.id);
      return { ok: true };
    } finally {
      db.close();
    }
  });
}

module.exports = todoRoutes;
