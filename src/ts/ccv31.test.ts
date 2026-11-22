import { describe, expect, test } from 'vitest'
import {
    cardLanguage,
    DEFAULT_GROUP_TALK,
    depthPromptInsertIndex,
    groupTalkFromCard,
    readCardDepthPrompt,
    readTalkativeness,
    talkativenessToGroupTalk,
    usesCCV31,
    writeCardDepthPrompt,
} from './ccv31'

describe('readCardDepthPrompt', () => {
    test('defaults depth to 4 and role to system', () => {
        expect(readCardDepthPrompt({ prompt: 'hi' })).toEqual({ prompt: 'hi', depth: 4, role: 'system' })
    })
    test('reads a negative depth as 0', () => {
        expect(readCardDepthPrompt({ prompt: 'hi', depth: -3 })?.depth).toBe(0)
    })
    test('reads a non-whole depth as the default', () => {
        expect(readCardDepthPrompt({ prompt: 'hi', depth: 2.5 })?.depth).toBe(4)
        expect(readCardDepthPrompt({ prompt: 'hi', depth: '2' })?.depth).toBe(4)
    })
    test('keeps a valid role and drops an invalid one', () => {
        expect(readCardDepthPrompt({ prompt: 'hi', depth: 1, role: 'assistant' })?.role).toBe('assistant')
        expect(readCardDepthPrompt({ prompt: 'hi', depth: 1, role: 'narrator' })?.role).toBe('system')
    })
    test('returns undefined without a string prompt', () => {
        expect(readCardDepthPrompt(undefined)).toBeUndefined()
        expect(readCardDepthPrompt({ depth: 2 })).toBeUndefined()
        expect(readCardDepthPrompt('text')).toBeUndefined()
    })
})

describe('writeCardDepthPrompt', () => {
    test('spells out depth and role', () => {
        expect(writeCardDepthPrompt({ prompt: 'p', depth: 2 })).toEqual({ prompt: 'p', depth: 2, role: 'system' })
    })
    test('round-trips through readCardDepthPrompt', () => {
        const dp = { prompt: 'p', depth: 0, role: 'user' as const }
        expect(readCardDepthPrompt(writeCardDepthPrompt(dp))).toEqual(dp)
    })
    test('passes undefined through', () => {
        expect(writeCardDepthPrompt(undefined)).toBeUndefined()
    })
})

describe('depthPromptInsertIndex', () => {
    test('counts from the end', () => {
        expect(depthPromptInsertIndex(10, 0)).toBe(10)
        expect(depthPromptInsertIndex(10, 4)).toBe(6)
    })
    test('never goes before the start', () => {
        expect(depthPromptInsertIndex(3, 10)).toBe(0)
    })
    test('treats a bad depth as 0', () => {
        expect(depthPromptInsertIndex(5, -2)).toBe(5)
        expect(depthPromptInsertIndex(5, NaN)).toBe(5)
    })
})

describe('readTalkativeness', () => {
    test('reads numbers and numeric strings', () => {
        expect(readTalkativeness(0.3)).toBe(0.3)
        expect(readTalkativeness('0.5')).toBe(0.5)
    })
    test('clamps to 0..1', () => {
        expect(readTalkativeness(2)).toBe(1)
        expect(readTalkativeness('-1')).toBe(0)
    })
    test('reads a non-number as the default', () => {
        expect(readTalkativeness('chatty')).toBe(0.5)
    })
    test('returns undefined when absent', () => {
        expect(readTalkativeness(undefined)).toBeUndefined()
        expect(readTalkativeness('')).toBeUndefined()
    })
})

test('talkativenessToGroupTalk snaps to sixths', () => {
    expect(talkativenessToGroupTalk(0.5)).toBe(3 / 6)
    expect(talkativenessToGroupTalk(0.7)).toBe(4 / 6)
    expect(talkativenessToGroupTalk(1)).toBe(1)
})

describe('groupTalkFromCard', () => {
    test('keeps the Risuai default without a value', () => {
        expect(groupTalkFromCard(undefined)).toBe(DEFAULT_GROUP_TALK)
    })
    test('keeps the Risuai default for exactly 0.5', () => {
        expect(groupTalkFromCard(0.5)).toBe(DEFAULT_GROUP_TALK)
        expect(groupTalkFromCard('0.5')).toBe(DEFAULT_GROUP_TALK)
        expect(groupTalkFromCard('chatty')).toBe(DEFAULT_GROUP_TALK)
    })
    test('uses any other value, snapped to sixths', () => {
        expect(groupTalkFromCard(0.2)).toBe(1 / 6)
        expect(groupTalkFromCard('0.9')).toBe(5 / 6)
        expect(groupTalkFromCard(0)).toBe(0)
    })
})

test('cardLanguage', () => {
    expect(cardLanguage({ localizations: { language: 'ko' } })).toBe('ko')
    expect(cardLanguage({})).toBe('')
    expect(cardLanguage(undefined)).toBe('')
})

describe('usesCCV31', () => {
    test('is false for a plain card', () => {
        expect(usesCCV31({ description: 'd', extensions: { depth_prompt: { prompt: 'x' }, talkativeness: '0.5' } })).toBe(false)
    })
    test('detects standard 3.1 keys', () => {
        expect(usesCCV31({ extensions: { localizations: { language: 'en' } } })).toBe(true)
        expect(usesCCV31({ extensions: { rating: 'general' } })).toBe(true)
    })
    test('detects lorebook entry localizations', () => {
        expect(usesCCV31({ character_book: { entries: [{ extensions: { localizations: { en: {} } } }] } })).toBe(true)
    })
    test('detects the {{lang}} CBS', () => {
        expect(usesCCV31({ system_prompt: 'Reply in {{lang}}.' })).toBe(true)
        expect(usesCCV31({ alternate_greetings: ['{{ LANG }}'] })).toBe(true)
    })
})
