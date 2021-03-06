import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const {load} = require('load-asciicast');

const color = require('./color');
const Background = require('./Background');
const Cursor = require('./Cursor');
const Document = require('./Document');
const Frame = require('./Frame');
const Reel = require('./Reel');
const Registry = require('./Registry');
const Viewbox = require('./Viewbox');
const Window = require('./Window');
const Word = require('./Word');
const styled = require('./styled');
const toViewModel = require('./to-view-model');

const DEFAULT_THEME = require('./default-theme');

const StyledContainer = styled.g`
  font-family: Monaco, Consolas, Menlo, 'Bitstream Vera Sans Mono', 'Powerline Symbols', monospace;
`;

export interface SvgTermOptions {
  at?: number;
  from?: number;
  height?: number;
  paddingX?: number;
  paddingY?: number;
  theme?: SvgTermTheme;
  to?: number;
  width?: number;
  window?: boolean;
  cursor?: boolean;
}

export type SvgTermColor = [number, number, number];

export interface SvgTermTheme {
  0: SvgTermColor;
  1: SvgTermColor;
  2: SvgTermColor;
  3: SvgTermColor;
  4: SvgTermColor;
  5: SvgTermColor;
  6: SvgTermColor;
  7: SvgTermColor;
  8: SvgTermColor;
  9: SvgTermColor;
  10: SvgTermColor;
  11: SvgTermColor;
  12: SvgTermColor;
  13: SvgTermColor;
  14: SvgTermColor;
  15: SvgTermColor;
  background: SvgTermColor;
  bold: SvgTermColor;
  cursor: SvgTermColor;
  text: SvgTermColor;
  fontSize: number;
  lineHeight: number;
}

export function render(raw: string, options: SvgTermOptions = {}): string {
  if (!raw) {
    throw new TypeError(`svg-term.reder: missing data`);
  }

  const paddingX = typeof options.paddingX === 'number' ? options.paddingX : 0;
  const paddingY = typeof options.paddingY === 'number' ? options.paddingY : 0;

  const theme = options.theme || DEFAULT_THEME;
  theme.fontSize = 'fontSize' in theme ? theme.fontSize : DEFAULT_THEME.fontSize;
  theme.lineHeight = 'lineHeight' in theme ? theme.lineHeight : DEFAULT_THEME.lineHeight;

  const lines = raw.split('\n');
  const rawAsciiLike = {
    version: 1,
    width: 120,
    height: lines.length,
    stdout: [
      [
        0,
        lines.map(line => `${line}\r\n`).join('')
      ]
    ]
  };

  const json = toJSON(rawAsciiLike);
  const cast = load(json, options.width, typeof options.height === 'number' ? options.height + 1 : undefined);
  const bound = {from: options.from, to: options.to, at: options.at, cast};

  const data = toViewModel({
    cast,
    cursor: options.cursor,
    height: options.height,
    theme,
    from: from(bound),
    to: to(bound)
  });

  const frame = data.frames[1];

  return renderToStaticMarkup(
    <Window
      decorations={options.window}
      width={data.width}
      height={data.displayHeight}
      theme={theme}
      paddingX={paddingX}
      paddingY={paddingY}
    >
      <Document
        width={data.width}
        height={data.displayHeight}
        theme={theme}
        x={options.window ? 15 + paddingX : options.paddingX}
        y={options.window ? 50 + paddingY : options.paddingY}
        >
        <StyledContainer fontSize={theme.fontSize}>
          <Background
            width={data.width}
            height={data.displayHeight}
            theme={theme}
            />
          <Frame
            offset={0}
            width={data.width}
            height={data.displayHeight}
            >
            {
              frame.cursor.visible &&
                <use
                  xlinkHref="#b"
                  x={frame.cursor.x - theme.fontSize * 1.2}
                  y={frame.cursor.y === 0 ? 0 : frame.cursor.y + theme.lineHeight * 0.75}
                  />
            }
            {
              frame.lines.map((line: any, index: number) => {
                if (typeof line.id === 'number') {
                  return (
                    <use
                      key={`${line.id}-${index}`}
                      xlinkHref={`#${line.id}`}
                      y={line.y}
                      />
                  );
                }
                return line.words.map((word: any) => {
                  return (
                    <Word
                      bg={word.attr.bg}
                      bold={word.attr.bold}
                      fg={word.attr.fg}
                      inverse={word.attr.inverse}
                      theme={theme}
                      underline={word.attr.underline}
                      x={word.x}
                      y={line.y + theme.fontSize}
                      >
                      {word.children}
                    </Word>
                  );
                })
              })
            }
          </Frame>
        </StyledContainer>
      </Document>
    </Window>
  );
}

function toJSON(raw: any): string {
  if (typeof raw === 'string') {
    return raw;
  }
  return JSON.stringify(raw);
}

const NOOP = () => true;
const MAX = (max: number) => ([f]: any) => f <= max;
const MIN = (min: number) => ([f]: any) => f >= min;

interface NearestOptions {
  cast: any;
  max?: number;
  min?: number;
}

interface ClampOptions {
  cast: any;
  at?: number;
  from?: number;
  to?: number;
}

function nearest(stamp: number, {cast, max, min}: NearestOptions) {
  return cast.frames
    .filter(typeof max === 'number' && !isNaN(max) ? MAX(max) : NOOP)
    .filter(typeof min === 'number' && !isNaN(min) ? MIN(min) : NOOP)
    .sort(([a]: any, [b]: any) => Math.abs((stamp - a)) - Math.abs((stamp - b)))[0][0];
}

function from(options: ClampOptions) {
  const {at, from, to, cast} = options;
  if (typeof at === 'number') {
    return nearest(at / 1000, {cast});
  }
  return typeof from === 'number' && !isNaN(from)
    ? nearest(from / 1000, {cast, min: from / 1000})
    : 0;
}

function to(options: ClampOptions) {
  const {at, from, to, cast} = options;
  if (typeof at === 'number') {
    return nearest(at / 1000, {cast});
  }
  return typeof to === 'number' && !isNaN(from)
    ? nearest(to / 1000, {cast, max: to / 1000})
    : cast.duration;
}
