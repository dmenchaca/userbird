import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthForm } from './auth-form';
import '@testing-library/jest-dom';
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Define type for Supabase auth responses
interface AuthResponse {
  data: any;
  error: any;
}

// Mock Supabase auth methods
const mockSignUp = jest.fn<() => Promise<AuthResponse>>();
const mockSignInWithPassword = jest.fn<() => Promise<AuthResponse>>();

// Mock supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword
    }
  }
}));

// Mock fetch for Netlify function calls
const mockFetch = jest.fn<typeof fetch>();
global.fetch = mockFetch;

// Mock useAuth hook
jest.mock('@/lib/auth', () => ({
  useAuth: jest.fn(() => ({
    signInWithGoogle: jest.fn(),
    user: null
  }))
}));

// Mock router
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    // Explicitly cast to any to avoid spread operator type issues
    ...(actual as any),
    useNavigate: () => jest.fn()
  };
});

describe('AuthForm component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful signup response
    mockSignUp.mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      },
      error: null
    });
    
    // Default successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Invitations updated successfully' })
    } as Response);
  });
  
  const renderAuthForm = (mode: 'signup' | 'login' = 'signup') => {
    return render(
      <BrowserRouter>
        <AuthForm mode={mode} />
      </BrowserRouter>
    );
  };
  
  test('should call Netlify function after successful signup', async () => {
    renderAuthForm('signup');
    
    // Fill in email and password
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    // Wait for signup to complete
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });
    
    // Verify Netlify function was called with correct data
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/link-user-invitations',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'user-123',
            email: 'test@example.com'
          })
        })
      );
    });
  });
  
  test('should complete signup even if invitation linking fails', async () => {
    // Make fetch fail
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    renderAuthForm('signup');
    
    // Fill in email and password
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    // Verify signup completed successfully despite fetch error
    await waitFor(() => {
      // Look for success message
      expect(screen.getByText(/account created/i)).toBeInTheDocument();
    });
  });
  
  test('should show error if signup fails', async () => {
    // Make signup fail
    mockSignUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Email already registered' }
    });
    
    renderAuthForm('signup');
    
    // Fill in email and password
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    // Verify error message is shown
    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument();
    });
    
    // Verify Netlify function was not called
    expect(mockFetch).not.toHaveBeenCalled();
  });
  
  test('should not call Netlify function for login mode', async () => {
    // Setup successful login response
    mockSignInWithPassword.mockResolvedValueOnce({
      data: {
        session: { user: { id: 'user-123' } }
      },
      error: null
    });
    
    renderAuthForm('login');
    
    // Fill in email and password
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    // Wait for login to complete
    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalled();
    });
    
    // Verify Netlify function was not called
    expect(mockFetch).not.toHaveBeenCalled();
  });
}); 