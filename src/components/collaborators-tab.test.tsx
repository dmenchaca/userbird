import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CollaboratorsTab } from './collaborators-tab';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Create mock functions
const mockFrom = jest.fn();
const mockRpc = jest.fn();

// Mock supabase
jest.mock('@/lib/supabase', () => {
  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc
    }
  };
});

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn()
  }
}));

describe('CollaboratorsTab component', () => {
  const mockFormId = 'form-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockFrom.mockImplementation((table) => {
      if (table === 'form_collaborators') {
        return {
          select: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'collab-1', invitation_email: 'test@example.com' }],
              error: null
            })
          }),
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      };
    });
    
    // Default RPC response (no existing user)
    mockRpc.mockResolvedValue({
      data: null,
      error: null
    });
  });
  
  test('should normalize email to lowercase when inviting', async () => {
    render(<CollaboratorsTab formId={mockFormId} />);
    
    // Find the email input and role selector
    const emailInput = screen.getByPlaceholderText(/colleague@example.com/i);
    
    // Enter a mixed-case email
    fireEvent.change(emailInput, { target: { value: 'Test@Example.com' } });
    
    // Submit the form
    const inviteButton = screen.getByRole('button', { name: /send invitation/i });
    fireEvent.click(inviteButton);
    
    // Wait for the invitation to be processed
    await waitFor(() => {
      // Check that supabase.rpc was called with lowercase email
      expect(mockRpc).toHaveBeenCalledWith(
        'get_user_id_by_email',
        { email_param: 'test@example.com' }
      );
      
      // Check that the insert was called with lowercase email
      const insertMock = mockFrom('form_collaborators').insert as jest.Mock;
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          invitation_email: 'test@example.com'
        })
      );
    });
    
    // Verify success message
    expect(toast.success).toHaveBeenCalledWith('Invitation sent successfully');
  });
  
  test('should validate email format', async () => {
    render(<CollaboratorsTab formId={mockFormId} />);
    
    // Find the email input
    const emailInput = screen.getByPlaceholderText(/colleague@example.com/i);
    
    // Enter an invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    
    // Submit the form
    const inviteButton = screen.getByRole('button', { name: /send invitation/i });
    fireEvent.click(inviteButton);
    
    // Check for validation error
    expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    
    // Verify supabase was not called
    expect(mockRpc).not.toHaveBeenCalled();
  });
  
  test('should auto-accept invitation if user exists', async () => {
    // Mock existing user
    mockRpc.mockResolvedValueOnce({
      data: 'existing-user-id',
      error: null
    });
    
    render(<CollaboratorsTab formId={mockFormId} />);
    
    // Find the email input
    const emailInput = screen.getByPlaceholderText(/colleague@example.com/i);
    
    // Enter email of existing user
    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    
    // Submit the form
    const inviteButton = screen.getByRole('button', { name: /send invitation/i });
    fireEvent.click(inviteButton);
    
    // Wait for the invitation to be processed
    await waitFor(() => {
      // Check that the insert was called with existing user ID and auto-accepted flag
      const insertMock = mockFrom('form_collaborators').insert as jest.Mock;
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'existing-user-id',
          invitation_accepted: true
        })
      );
    });
  });
  
  test('should handle invitation error gracefully', async () => {
    // Mock insert error
    mockFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      }),
      eq: jest.fn().mockResolvedValue({
        data: [],
        error: null
      })
    }));
    
    render(<CollaboratorsTab formId={mockFormId} />);
    
    // Find the email input
    const emailInput = screen.getByPlaceholderText(/colleague@example.com/i);
    
    // Enter email
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    
    // Submit the form
    const inviteButton = screen.getByRole('button', { name: /send invitation/i });
    fireEvent.click(inviteButton);
    
    // Wait for the error to be handled
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Database error');
    });
  });
}); 