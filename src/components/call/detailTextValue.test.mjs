import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DetailTextValue } from "./detailTextValue.ts";

test("renders a div wrapper for loading fallback content", () => {
  const html = renderToStaticMarkup(
    React.createElement(DetailTextValue, {
      className: "mt-1",
      value: undefined,
      fallback: React.createElement("div", { className: "skeleton" }),
    }),
  );

  assert.equal(html, '<div class="mt-1"><div class="skeleton"></div></div>');
});

test("renders a paragraph when text content is available", () => {
  const html = renderToStaticMarkup(
    React.createElement(DetailTextValue, {
      className: "mt-1",
      value: "Ready",
      fallback: React.createElement("div", { className: "skeleton" }),
    }),
  );

  assert.equal(html, '<p class="mt-1">Ready</p>');
});
