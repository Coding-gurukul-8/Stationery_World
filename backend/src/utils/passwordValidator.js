/**
 * Password Requirements:
 * - At least 8 characters
 * - 1 uppercase letter
 * - 1 lowercase letter
 * - 1 number
 * - 1 special character (!@#$%^&*(),.?":{}|<>)
 */

const validatePassword = (password) => {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least 1 uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least 1 lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least 1 number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least 1 special character (!@#$%^&*(),.?":{}|<>)');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

const generatePasswordRequirementsText = () => {
  return `Password must contain:
- At least 8 characters
- 1 uppercase letter (A-Z)
- 1 lowercase letter (a-z)  
- 1 number (0-9)
- 1 special character (!@#$%^&*(),.?":{}|<>)`;
};

module.exports = {
  validatePassword,
  generatePasswordRequirementsText
};