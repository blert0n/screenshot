import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import cronJob from "./cron.js";
import "dotenv/config";
import { takeScreenshot } from "./util.js";

const app = express();
const PORT = process.env.PORT || 9090;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: "POST,GET",
  })
);

app.use(express.json({ limit: "50mb" }));

app.get("/", (req, res) => {
  res.send("Hey!");
});

app.post("/thumbnail", bodyParser.json(), async (req, res) => {
  const payload = req.body;

  if (!payload.url || !payload.id)
    return res.status(400).send({
      success: false,
      message: "Url is missing",
    });

  const imageUrl = await takeScreenshot(
    payload.url,
    payload.fullpage,
    payload.backgroundColor
  );

  if (!imageUrl)
    return res.status(400).send({
      success: false,
      message: "Upload failed",
    });

  const data = {
    id: payload.id,
    imageUrl,
  };

  return res.status(200).send({
    success: true,
    data,
  });
});

const SYS_PROMPT = `You are an assistant that generates JSON arrays of form items for a form builder. Each item must follow these strict rules:
### Enum:
Use only these exact \`type\` values (case-sensitive):
FormItemType_Enum = {
  Date = 'DATE',
  Dropdown = 'DROPDOWN',
  LinearScale = 'LINEAR_SCALE',
  Long = 'LONG',
  MultipleChoice = 'MULTIPLE_CHOICE',
  MultipleChoiceGrid = 'MULTIPLE_CHOICE_GRID',
  PhoneNumber = 'PHONE_NUMBER',
  Rating = 'RATING',
  Short = 'SHORT',
  SingleChoice = 'SINGLE_CHOICE',
  SingleChoiceGrid = 'SINGLE_CHOICE_GRID',
  Text = 'TEXT'
}
⚠️ Do NOT use the type: 'SECTION' or 'TEXT'.

### General Rules:
- Return a plain JSON array only (no markdown, escaping, or comments).
- Each form item must include:
  - \`id\`: UUIDv4 string
  - \`type\`: must be one of the above Enum values
  - \`order\`: integer starting at 1
  - \`origin\`: always "client"
  - \`name\`: string in valid HTML:
    \`<p dir="ltr"><span style="white-space: pre-wrap;">Your label here</span></p>\`
  - \`section\`: always 0
  - \`required\`: true or false
  - \`options\`: must follow rules below

### Options by Type:
Each option inside the \`options\` array **MUST** include a UUIDv4 string as \`id\` along with other required fields.

Follow this exact structure:

- LINEAR_SCALE:
  - Exactly 2 options, each with:
    - \`id\`: UUIDv4 string
    - \`value\`: stringified number (minimum is "1" and maximum "10")
    - \`order\`: number (1 or 2)
    - \`label\`: string

- RATING:
  - Exactly 1 option, with:
    - \`id\`: UUIDv4 string
    - \`value\`: stringified number like "5" (maximum "10")
    - \`order\`: 1

- SINGLE_CHOICE, MULTIPLE_CHOICE, DROPDOWN:
  - At least 2 options, each with:
    - \`id\`: UUIDv4 string
    - \`value\`: any string
    - \`order\`: number

- SINGLE_CHOICE_GRID, MULTIPLE_CHOICE_GRID:
  - At least 1 row and 1 column, each option with:
    - \`id\`: UUIDv4 string
    - \`value\`: any string
    - \`order\`: number
    - \`grid\`: either "row" or "column"

- SHORT, LONG, PHONE_NUMBER, DATE, TEXT → \`options: []\`

### Output:
Return a clean JSON array of form items only.
No markdown, no escaping, no explanations.

Make sure:
- All values are strings where expected (e.g. labels)
- Only LINEAR_SCALE and RATING use stringified numbers as \`value\` in their options
- All \`id\`s (both form items and options) are UUIDv4 strings
- The \`origin\` is always "client"
- The \`type\` never equals "SECTION"`;

const conversations = {};

app.post("/questify-bot", async (req, res) => {
  try {
    const { conversation, prompt, currentState } = req.body;

    if (!conversation || !prompt) {
      return res
        .status(400)
        .json({ message: "Missing conversation or prompt" });
    }

    if (!conversations[conversation]) {
      conversations[conversation] = [
        { role: "system", content: SYS_PROMPT },
        {
          role: "user",
          content: `Here is the current form:\n\`\`\`json\n${JSON.stringify(
            currentState,
            null,
            2
          )}\n\`\`\``,
        },
      ];
    }

    conversations[conversation].push({ role: "user", content: prompt });

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat-v3-0324:free",
          messages: conversations[conversation],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        message: "Failed to fetch from OpenRouter API",
        error: errorText,
      });
    }

    const data = await response.json();

    const rawContent = data.choices?.[0]?.message?.content || "";

    conversations[conversation].push({
      role: "assistant",
      content: rawContent,
    });

    const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      return res.status(500).json({
        message: "Failed to parse JSON from AI response.",
      });
    }

    let formItems;
    try {
      formItems = JSON.parse(jsonMatch[1]);
    } catch {
      return res.status(500).json({
        message: "Invalid JSON format from AI response.",
      });
    }

    return res.status(200).json({ message: "Success", data: formItems });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Internal server error" });
  }
});

cronJob.start();

app.listen(PORT, () => {
  console.log(`Screenshot app listening on port ${PORT}`);
});
