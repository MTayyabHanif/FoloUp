import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PROMPT_FOOTER_TEMPLATE } from "@/lib/constants";
import { appendFooter, stripFooter } from "@/lib/promptFooter";

describe("appendFooter", () => {
  it("appends the footer separated by a blank line", () => {
    const result = appendFooter("My body");
    assert.ok(result.endsWith(PROMPT_FOOTER_TEMPLATE));
    assert.ok(result.includes("My body\n\n"));
  });

  it("trims leading and trailing whitespace from the body", () => {
    const result = appendFooter("  hello world\n\n");
    assert.ok(result.startsWith("hello world"));
    assert.ok(result.endsWith(PROMPT_FOOTER_TEMPLATE));
  });
});

describe("stripFooter", () => {
  it("round-trips with appendFooter", () => {
    assert.equal(stripFooter(appendFooter("My body")), "My body");
  });

  it("returns the input unchanged when the footer is not present", () => {
    assert.equal(stripFooter("No footer here"), "No footer here");
  });

  it("normalizes CRLF line endings before matching", () => {
    const prompt = `Body line one\r\n\r\n${PROMPT_FOOTER_TEMPLATE.replace(/\n/g, "\r\n")}`;
    assert.equal(stripFooter(prompt), "Body line one");
  });
});
