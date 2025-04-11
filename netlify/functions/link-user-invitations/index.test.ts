import { handler } from './index';
import { createClient } from '@supabase/supabase-js';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import { Handler, HandlerResponse } from '@netlify/functions';

// Create the mock manually since TypeScript has issues with jest.mock
const createClientMock = jest.fn();

// Mock @supabase/supabase-js
jest.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock
}));

describe('link-user-invitations function', () => {
  // Mock Supabase client and responses
  const mockSelect = jest.fn();
  const mockUpdate = jest.fn();
  
  // Create a better mock structure that matches supabase client API
  const createMockBuilder = () => {
    const filter = jest.fn().mockReturnThis();
    const is = jest.fn().mockReturnThis();
    const select = jest.fn(() => ({ data: null, error: null }));
    const update = jest.fn(() => ({ data: null, error: null }));
    
    const builder = {
      select: jest.fn(() => builder),
      update: jest.fn(() => builder),
      filter,
      is,
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() => ({
        data: null,
        error: null
      })),
      then: jest.fn().mockImplementation((callback) => {
        if (builder.isSelectCall) {
          return Promise.resolve(callback(mockSelect()));
        } else if (builder.isUpdateCall) {
          return Promise.resolve(callback(mockUpdate()));
        }
        return Promise.resolve(callback({ data: null, error: null }));
      }),
      isSelectCall: false,
      isUpdateCall: false
    };
    
    // Override select to set flag
    builder.select.mockImplementation(() => {
      builder.isSelectCall = true;
      return builder;
    });
    
    // Override update to set flag
    builder.update.mockImplementation(() => {
      builder.isUpdateCall = true;
      return builder;
    });
    
    return builder;
  };
  
  const mockFrom = jest.fn(() => createMockBuilder());
  
  const mockSupabaseClient = {
    from: mockFrom
  };
  
  type MockResponse = {
    data: any;
    error: any;
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    createClientMock.mockReturnValue(mockSupabaseClient);
    
    // Default successful responses
    mockSelect.mockReturnValue({
      data: [{ id: 'collab-1', invitation_email: 'test@example.com' }],
      error: null
    } as MockResponse);
    
    mockUpdate.mockReturnValue({
      data: [{ id: 'collab-1', invitation_email: 'test@example.com', user_id: 'user-123' }],
      error: null
    } as MockResponse);
  });
  
  // Helper function to simulate event
  const createEvent = (body: any) => ({
    httpMethod: 'POST',
    body: JSON.stringify(body),
    headers: {},
    isBase64Encoded: false,
    rawUrl: '',
    rawQuery: ''
  });
  
  test('should normalize email to lowercase before processing', async () => {
    // Create an event with mixed case email
    const event = createEvent({
      id: 'user-123',
      email: 'Test@Example.com'
    });
    
    const response = await handler(event as any, {} as any, () => {}) as HandlerResponse;
    
    // Verify that filter was called with lowercase email
    expect(mockFilter).toHaveBeenCalledWith('invitation_email', 'ilike', 'test@example.com');
  });
  
  test('should reject null or undefined user IDs', async () => {
    // Create an event with null user ID
    const event = createEvent({
      id: null,
      email: 'test@example.com'
    });
    
    const response = await handler(event as any, {} as any, () => {}) as HandlerResponse;
    
    // Verify error response
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain('Missing required user data');
  });
  
  test('should properly handle null in database queries', async () => {
    const event = createEvent({
      id: 'user-123',
      email: 'test@example.com'
    });
    
    const response = await handler(event as any, {} as any, () => {}) as HandlerResponse;
    
    // Verify that is method is used for null check instead of match
    expect(mockIs).toHaveBeenCalledWith('user_id', null);
  });
  
  test('should match invitation emails case-insensitively', async () => {
    const event = createEvent({
      id: 'user-123',
      email: 'TEST@example.COM'
    });
    
    const response = await handler(event as any, {} as any, () => {}) as HandlerResponse;
    
    // Verify that ilike filter is used for case-insensitive matching
    expect(mockFilter).toHaveBeenCalledWith('invitation_email', 'ilike', 'test@example.com');
  });
  
  test('should not block if invitation linking fails', async () => {
    // Make update fail with an error
    mockUpdate.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' }
    } as MockResponse);
    
    const event = createEvent({
      id: 'user-123',
      email: 'test@example.com'
    });
    
    const response = await handler(event as any, {} as any, () => {}) as HandlerResponse;
    
    // Verify error response
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).error).toBeDefined();
  });
  
  test('should update both user_id and invitation_accepted fields', async () => {
    const event = createEvent({
      id: 'user-123',
      email: 'test@example.com'
    });
    
    const response = await handler(event as any, {} as any, () => {}) as HandlerResponse;
    
    // Verify that update payload contains both fields
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-123',
      invitation_accepted: true
    }));
  });
  
  test('should gracefully handle no matching invitations', async () => {
    // Simulate no invitations found
    mockSelect.mockResolvedValueOnce({
      data: [],
      error: null
    } as MockResponse);
    
    const event = createEvent({
      id: 'user-123',
      email: 'no-invites@example.com'
    });
    
    const response = await handler(event as any, {} as any, () => {}) as HandlerResponse;
    
    // Verify success response with zero updates
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).updatedCount).toBe(0);
  });
  
  test('should use ISO string format for timestamps', async () => {
    const event = createEvent({
      id: 'user-123',
      email: 'test@example.com'
    });
    
    await handler(event as any, {} as any, () => {});
    
    // Verify that update includes correctly formatted timestamp
    const updateCall = mockUpdate.mock.calls[0][0] as any;
    expect(updateCall.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  });
  
  test('should validate required fields in request payload', async () => {
    // Test missing id
    const missingIdEvent = createEvent({
      email: 'test@example.com'
    });
    
    const missingIdResponse = await handler(missingIdEvent as any, {} as any, () => {}) as HandlerResponse;
    expect(missingIdResponse.statusCode).toBe(400);
    
    // Test missing email
    const missingEmailEvent = createEvent({
      id: 'user-123'
    });
    
    const missingEmailResponse = await handler(missingEmailEvent as any, {} as any, () => {}) as HandlerResponse;
    expect(missingEmailResponse.statusCode).toBe(400);
    
    // Test malformed payload
    const malformedEvent = {
      httpMethod: 'POST',
      body: 'not-valid-json',
      headers: {}
    };
    
    const malformedResponse = await handler(malformedEvent as any, {} as any, () => {}) as HandlerResponse;
    expect(malformedResponse.statusCode).toBe(400);
  });
  
  test('should handle and log database errors', async () => {
    // Mock console.error to check logging
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Make database operation fail
    mockSelect.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error during select' }
    } as MockResponse);
    
    const event = createEvent({
      id: 'user-123',
      email: 'test@example.com'
    });
    
    const response = await handler(event as any, {} as any, () => {}) as HandlerResponse;
    
    // Verify error is logged
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0][0]).toContain('Error checking for invitations');
    
    // Verify error response
    expect(response.statusCode).toBe(500);
    
    consoleSpy.mockRestore();
  });
}); 