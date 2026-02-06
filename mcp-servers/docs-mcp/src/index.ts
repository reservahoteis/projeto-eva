#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";

// Caminho para as skills
const SKILLS_PATH = path.resolve(process.cwd(), ".claude/skills");

// Interface para secoes indexadas
interface Section {
  skill: string;
  title: string;
  content: string;
  keywords: string[];
}

// Cache de secoes indexadas
let sectionsCache: Section[] = [];

// Indexar todas as skills
function indexSkills(): Section[] {
  const sections: Section[] = [];

  try {
    const skillDirs = fs.readdirSync(SKILLS_PATH);

    for (const dir of skillDirs) {
      const skillPath = path.join(SKILLS_PATH, dir, "SKILL.md");

      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, "utf-8");
        const skillSections = parseSkillSections(dir, content);
        sections.push(...skillSections);
      }
    }
  } catch (error) {
    console.error("Error indexing skills:", error);
  }

  return sections;
}

// Parsear secoes de uma skill
function parseSkillSections(skillName: string, content: string): Section[] {
  const sections: Section[] = [];
  const lines = content.split("\n");

  let currentTitle = "";
  let currentContent: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Track code blocks
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      currentContent.push(line);
      continue;
    }

    // Detectar titulos (## ou ###)
    if (!inCodeBlock && line.match(/^#{2,3}\s+/)) {
      // Salvar secao anterior
      if (currentTitle && currentContent.length > 0) {
        const sectionContent = currentContent.join("\n").trim();
        if (sectionContent.length > 50) {
          sections.push({
            skill: skillName,
            title: currentTitle,
            content: sectionContent,
            keywords: extractKeywords(currentTitle, sectionContent),
          });
        }
      }

      currentTitle = line.replace(/^#+\s+/, "").trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Ultima secao
  if (currentTitle && currentContent.length > 0) {
    const sectionContent = currentContent.join("\n").trim();
    if (sectionContent.length > 50) {
      sections.push({
        skill: skillName,
        title: currentTitle,
        content: sectionContent,
        keywords: extractKeywords(currentTitle, sectionContent),
      });
    }
  }

  return sections;
}

// Extrair keywords de uma secao
function extractKeywords(title: string, content: string): string[] {
  const keywords = new Set<string>();

  // Adicionar titulo
  title.toLowerCase().split(/\s+/).forEach((w) => keywords.add(w));

  // Extrair palavras de funcoes/metodos
  const codeMatches = content.match(
    /(?:function|const|async|class|interface|type)\s+(\w+)/g
  );
  if (codeMatches) {
    codeMatches.forEach((m) => {
      const word = m.split(/\s+/).pop();
      if (word) keywords.add(word.toLowerCase());
    });
  }

  // Termos tecnicos comuns
  const techTerms = content.match(
    /\b(query|mutation|cache|hook|middleware|route|schema|model|auth|token|socket|redis|prisma|zod|react|next|express)\b/gi
  );
  if (techTerms) {
    techTerms.forEach((t) => keywords.add(t.toLowerCase()));
  }

  return Array.from(keywords);
}

// Buscar secoes relevantes
function searchSections(query: string, limit: number = 3): Section[] {
  if (sectionsCache.length === 0) {
    sectionsCache = indexSkills();
  }

  const queryWords = query.toLowerCase().split(/\s+/);
  const scored: { section: Section; score: number }[] = [];

  for (const section of sectionsCache) {
    let score = 0;

    // Match em keywords
    for (const word of queryWords) {
      if (section.keywords.some((k) => k.includes(word))) {
        score += 10;
      }
      if (section.title.toLowerCase().includes(word)) {
        score += 20;
      }
      if (section.skill.toLowerCase().includes(word)) {
        score += 15;
      }
      if (section.content.toLowerCase().includes(word)) {
        score += 5;
      }
    }

    if (score > 0) {
      scored.push({ section, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.section);
}

// Listar skills disponiveis
function listAvailableSkills(): string[] {
  try {
    return fs
      .readdirSync(SKILLS_PATH)
      .filter((dir) =>
        fs.existsSync(path.join(SKILLS_PATH, dir, "SKILL.md"))
      );
  } catch {
    return [];
  }
}

// Buscar checklist de uma skill
function getSkillChecklist(skillName: string): string | null {
  const skillPath = path.join(SKILLS_PATH, skillName, "SKILL.md");

  if (!fs.existsSync(skillPath)) {
    return null;
  }

  const content = fs.readFileSync(skillPath, "utf-8");
  const checklistMatch = content.match(
    /## Checklist[\s\S]*?(?=\n## |$)/i
  );

  return checklistMatch ? checklistMatch[0].trim() : null;
}

// Criar servidor MCP
const server = new Server(
  {
    name: "docs-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Registrar ferramentas
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "docs_search_pattern",
      description:
        "Busca padroes e exemplos de codigo nas documentacoes do projeto. Use para encontrar como implementar algo especifico sem carregar documentos inteiros.",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description:
              "O que voce quer encontrar. Ex: 'prisma transaction', 'jwt refresh token', 'tanstack mutation optimistic'",
          },
          limit: {
            type: "number",
            description: "Numero maximo de resultados (default: 3)",
            default: 3,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "docs_list_skills",
      description:
        "Lista todas as skills/documentacoes disponiveis no projeto",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "docs_get_checklist",
      description:
        "Retorna apenas o checklist de boas praticas de uma skill especifica. Util para verificacao rapida.",
      inputSchema: {
        type: "object" as const,
        properties: {
          skill: {
            type: "string",
            description:
              "Nome da skill. Ex: tech-prisma, tech-jwt, tech-nextjs",
          },
        },
        required: ["skill"],
      },
    },
    {
      name: "docs_get_section",
      description:
        "Busca uma secao especifica de uma skill pelo titulo aproximado",
      inputSchema: {
        type: "object" as const,
        properties: {
          skill: {
            type: "string",
            description: "Nome da skill",
          },
          section: {
            type: "string",
            description:
              "Titulo da secao. Ex: 'Transactions', 'Middleware', 'Mutations'",
          },
        },
        required: ["skill", "section"],
      },
    },
  ],
}));

// Handler das ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "docs_search_pattern": {
      const { query, limit = 3 } = args as { query: string; limit?: number };
      const results = searchSections(query, limit);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Nenhum resultado encontrado para: "${query}"`,
            },
          ],
        };
      }

      const formatted = results
        .map(
          (r) =>
            `### ${r.skill} > ${r.title}\n\n${r.content}`
        )
        .join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text: formatted }],
      };
    }

    case "docs_list_skills": {
      const skills = listAvailableSkills();
      const formatted = skills
        .map((s) => `- ${s}`)
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `## Skills Disponiveis\n\n${formatted}`,
          },
        ],
      };
    }

    case "docs_get_checklist": {
      const { skill } = args as { skill: string };
      const checklist = getSkillChecklist(skill);

      if (!checklist) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Skill "${skill}" nao encontrada ou sem checklist`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: checklist }],
      };
    }

    case "docs_get_section": {
      const { skill, section } = args as { skill: string; section: string };
      const results = searchSections(`${skill} ${section}`, 1);

      if (results.length === 0 || results[0].skill !== skill) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Secao "${section}" nao encontrada em "${skill}"`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `## ${results[0].title}\n\n${results[0].content}`,
          },
        ],
      };
    }

    default:
      return {
        content: [
          { type: "text" as const, text: `Tool desconhecida: ${name}` },
        ],
      };
  }
});

// Iniciar servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("docs-mcp server running on stdio");
}

main().catch(console.error);
