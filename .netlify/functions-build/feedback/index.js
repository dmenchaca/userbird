"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const validation_1 = require("./validation");
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
function getCorsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Accept, Origin',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json',
        'Vary': 'Origin'
    };
}
async function validateFormId(formId, origin) {
    try {
        const { data: form } = await supabase
            .from('forms')
            .select('url')
            .eq('id', formId)
            .single();
        if (!form)
            return false;
        return (0, validation_1.isValidOrigin)(origin, form.url);
    }
    catch {
        return false;
    }
}
const handler = async (event) => {
    const origin = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(origin);
    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }
    try {
        // Validate request
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({ error: 'Method not allowed' })
            };
        }
        const body = JSON.parse(event.body || '{}');
        const { formId, message } = body;
        if (!formId || !message?.trim()) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid request data' })
            };
        }
        // Validate origin
        if (origin) {
            const isValid = await validateFormId(formId, origin);
            if (!isValid) {
                return {
                    statusCode: 403,
                    headers,
                    body: JSON.stringify({ error: 'Origin not allowed' })
                };
            }
        }
        // Store feedback
        const { error: insertError } = await supabase
            .from('feedback')
            .insert([{ form_id: formId, message }]);
        if (insertError)
            throw insertError;
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };
    }
    catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
exports.handler = handler;
