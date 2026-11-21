// Character Card V3.1 helpers.
// V3.1 adds no field to `data`; its additions are standard keys inside `extensions`.
// These helpers read and write those keys without touching Risuai's own forms.

export type DepthPromptRole = 'system' | 'user' | 'assistant'

export interface DepthPrompt {
    depth: number
    prompt: string
    role?: DepthPromptRole
}

const DEFAULT_CARD_DEPTH = 4
const DEPTH_PROMPT_ROLES: DepthPromptRole[] = ['system', 'user', 'assistant']

/**
 * Reads `extensions.depth_prompt` from a card.
 * `depth` defaults to 4, a negative depth is read as 0 and a non-whole number as the default.
 * `role` defaults to `system`.
 */
export function readCardDepthPrompt(value: unknown): DepthPrompt | undefined {
    if(!value || typeof value !== 'object'){
        return undefined
    }
    const v = value as Record<string, unknown>
    if(typeof v.prompt !== 'string'){
        return undefined
    }
    let depth = DEFAULT_CARD_DEPTH
    if(typeof v.depth === 'number' && Number.isInteger(v.depth)){
        depth = Math.max(0, v.depth)
    }
    const role = DEPTH_PROMPT_ROLES.includes(v.role as DepthPromptRole) ? v.role as DepthPromptRole : 'system'
    return { prompt: v.prompt, depth, role }
}

/** Writes `extensions.depth_prompt` with `depth` and `role` spelled out, as V3.1 asks. */
export function writeCardDepthPrompt(dp: DepthPrompt | undefined): Required<DepthPrompt> | undefined {
    if(!dp){
        return undefined
    }
    return {
        prompt: dp.prompt ?? '',
        depth: Number.isInteger(dp.depth) ? Math.max(0, dp.depth) : 0,
        role: DEPTH_PROMPT_ROLES.includes(dp.role) ? dp.role : 'system',
    }
}

/** Index at which a depth prompt is inserted into a list of `length` messages. */
export function depthPromptInsertIndex(length: number, depth: number): number {
    const d = Number.isInteger(depth) ? Math.max(0, depth) : 0
    return Math.max(0, length - d)
}

/**
 * Reads `extensions.talkativeness`: a number or a string holding one, between 0 and 1.
 * Out-of-range values are clamped; a value that is not a number gives the default 0.5.
 * Returns undefined when the card has no value.
 */
export function readTalkativeness(value: unknown): number | undefined {
    if(value === undefined || value === null || value === ''){
        return undefined
    }
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN
    if(!Number.isFinite(n)){
        return 0.5
    }
    return Math.min(1, Math.max(0, n))
}

/** Snaps a talkativeness value to the 1/6 steps of the group chat talk slider. */
export function talkativenessToGroupTalk(value: number): number {
    return Math.round(value * 6) / 6
}

/** The language of the card's base fields (`extensions.localizations.language`), or ''. */
export function cardLanguage(extensions: Record<string, any> | undefined): string {
    const lang = extensions?.localizations?.language
    return typeof lang === 'string' ? lang : ''
}

const V31_CARD_KEYS = ['localizations', 'asset_info', 'narration', 'user_pov', 'rating', 'license']
const LANG_CBS = /\{\{\s*lang\s*\}\}/i

interface CardDataLike {
    extensions?: Record<string, any>
    character_book?: { entries?: { content?: string, extensions?: Record<string, any> }[] }
    [key: string]: any
}

/**
 * Whether a card uses one of the V3.1 additions that make it a 3.1 card.
 * `depth_prompt`, `talkativeness` and the `::` separator do not count.
 */
export function usesCCV31(data: CardDataLike): boolean {
    const ext = data.extensions ?? {}
    if(V31_CARD_KEYS.some((key) => ext[key] !== undefined && ext[key] !== null)){
        return true
    }
    const entries = data.character_book?.entries ?? []
    if(entries.some((entry) => entry?.extensions?.localizations)){
        return true
    }
    const texts: unknown[] = [
        data.description, data.personality, data.scenario, data.first_mes, data.mes_example,
        data.system_prompt, data.post_history_instructions, data.creator_notes,
        ...(data.alternate_greetings ?? []), ...(data.group_only_greetings ?? []),
        ...entries.map((entry) => entry?.content),
    ]
    return texts.some((text) => typeof text === 'string' && LANG_CBS.test(text))
}
