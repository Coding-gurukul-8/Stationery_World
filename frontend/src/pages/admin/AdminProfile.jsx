import { useState, useEffect } from 'react';
import { authUtils } from '../../utils/auth';
import { Edit2, Camera, Save, X } from 'lucide-react';
import { API_BASE_URL } from '../../config/constants';
import { compressImageFile, isSupportedImageType } from '../../utils/imageCompression';

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Ccircle cx='75' cy='75' r='75' fill='%23dc3545'/%3E%3Cpath d='M75 40c-11 0-20 9-20 20s9 20 20 20 20-9 20-20-9-20-20-20zm0 60c-16.5 0-30 8.5-30 19v6h60v-6c0-10.5-13.5-19-30-19z' fill='%23fff'/%3E%3C/svg%3E";

const API = API_BASE_URL;

// Helper function to get full image URL
const getImageUrl = (photoUrl) => {
  if (!photoUrl) return DEFAULT_AVATAR;
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://') || photoUrl.startsWith('data:')) {
    return photoUrl;
  }
  if (photoUrl.startsWith('/uploads/')) {
    return `${API}${photoUrl}`;
  }
  return photoUrl;
};

export default function AdminProfile() {
  const [user, setUser] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [newPhoto, setNewPhoto] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Load user data
  useEffect(() => {
    const userData = authUtils.getUser();
    setUser(userData);
    setEditValues(userData || {});
  }, []);

  // Handle field edit start
  const startEdit = (field) => {
    setEditingField(field);
    setMessage({ type: '', text: '' });
  };

  // Handle field edit cancel
  const cancelEdit = () => {
    setEditingField(null);
    setEditValues(user);
    setPhotoPreview(null);
    setNewPhoto(null);
  };

  // Handle input change
  const handleChange = (field, value) => {
    setEditValues(prev => ({ ...prev, [field]: value }));
  };

  // Handle photo selection
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    if (!isSupportedImageType(file)) {
      setMessage({ type: 'error', text: 'Invalid file type. Only JPG, PNG, and WEBP are allowed.' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size should be less than 5MB' });
      return;
    }

    setMessage({ type: '', text: '' });
    setLoading(true);

    try {
      const compressedPhoto = await compressImageFile(file, { maxSizeKB: 100, maxWidthOrHeight: 1280 });
      setNewPhoto(compressedPhoto);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(compressedPhoto);

      setMessage({ type: 'success', text: `Image compressed from ${Math.round(file.size / 1024)}KB to ${Math.round(compressedPhoto.size / 1024)}KB` });
    } catch (error) {
      console.error('Photo compression failed:', error);
      setMessage({ type: 'error', text: error.message || 'Image compression failed' });
      setNewPhoto(null);
      setPhotoPreview(null);
    } finally {
      setLoading(false);
    }
  };

  // Save field changes
  const saveField = async (field) => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // If saving photo
      if (field === 'photo' && newPhoto) {
        const formData = new FormData();
        formData.append('photo', newPhoto);

        console.log('Uploading admin photo:', newPhoto.name, 'Size:', newPhoto.size);

        const response = await fetch(`${API}/api/user/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${authUtils.getToken()}`
          },
          body: formData
        });

        const data = await response.json();
        console.log('Admin photo upload response:', data);

        if (!response.ok) {
          throw new Error(data.message || 'Failed to update photo');
        }

        // Update user in state and localStorage
        const updatedUser = data.data;
        setUser(updatedUser);
        authUtils.setUser(updatedUser);
        setEditValues(updatedUser);
        
        setPhotoPreview(null);
        setNewPhoto(null);
        setEditingField(null);
        setMessage({ type: 'success', text: 'Admin profile photo updated successfully!' });

        // ✅ Dispatch custom event to update all components
        window.dispatchEvent(new CustomEvent('userUpdated', { detail: updatedUser }));
      } else {
        // Update other fields
        const updateData = {};
        updateData[field] = editValues[field];

        console.log('Updating admin field:', field, 'Value:', editValues[field]);

        const response = await fetch(`${API}/api/user/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authUtils.getToken()}`
          },
          body: JSON.stringify(updateData)
        });

        const data = await response.json();
        console.log('Admin field update response:', data);

        if (!response.ok) {
          throw new Error(data.message || 'Failed to update profile');
        }

        // Update user in state and localStorage
        const updatedUser = data.data;
        setUser(updatedUser);
        authUtils.setUser(updatedUser);
        setEditValues(updatedUser);
        setMessage({ type: 'success', text: 'Admin profile updated successfully!' });
        setEditingField(null);

        // ✅ Dispatch custom event to update all components
        window.dispatchEvent(new CustomEvent('userUpdated', { detail: updatedUser }));
      }
    } catch (error) {
      console.error('Admin update error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  // Render editable field
  const renderField = (label, field, value, type = 'text') => (
    <div style={{ 
      marginBottom: 16, 
      padding: 12, 
      border: '1px solid #e0e0e0', 
      borderRadius: 8,
      backgroundColor: editingField === field ? '#fff5f5' : 'white'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4, fontWeight: 500 }}>
            {label}
          </label>
          
          {editingField === field ? (
            <input
              type={type}
              value={editValues[field] || ''}
              onChange={(e) => handleChange(field, e.target.value)}
              style={{
                width: '100%',
                padding: 8,
                border: '1px solid #ccc',
                borderRadius: 4,
                fontSize: 14
              }}
              autoFocus
            />
          ) : (
            <div style={{ fontSize: 14, color: '#333' }}>
              {type === 'password' ? '••••••••' : (value || <span style={{ color: '#999' }}>Not set</span>)}
            </div>
          )}
        </div>

        <div style={{ marginLeft: 12, display: 'flex', gap: 8 }}>
          {editingField === field ? (
            <>
              <button
                onClick={() => saveField(field)}
                disabled={loading}
                style={{
                  padding: '6px 12px',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 13
                }}
              >
                <Save size={16} />
                {loading ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                disabled={loading}
                style={{
                  padding: '6px 12px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 13
                }}
              >
                <X size={16} />
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => startEdit(field)}
              style={{
                padding: '6px 12px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 13
              }}
            >
              <Edit2 size={16} />
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (!user) {
    return <div className="card">Loading...</div>;
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ color: '#dc3545' }}>Admin Profile</h3>
        <p style={{ color: '#666', fontSize: 14 }}>Manage your administrator account settings</p>
      </div>

      {/* Message Display */}
      {message.text && (
        <div style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 8,
          backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
          color: message.type === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {message.text}
        </div>
      )}

      {/* Profile Photo Section */}
      <div style={{
        marginBottom: 24,
        padding: 20,
        border: '2px solid #dc3545',
        borderRadius: 8,
        backgroundColor: '#fff5f5',
        textAlign: 'center'
      }}>
        <label style={{ fontSize: 14, color: '#666', display: 'block', marginBottom: 16, fontWeight: 500 }}>
          Admin Profile Photo
        </label>

        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src={photoPreview || getImageUrl(user.photoUrl)}
            alt={user.name}
            style={{
              width: 150,
              height: 150,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '4px solid #dc3545'
            }}
            onError={(e) => {
              e.target.src = DEFAULT_AVATAR;
            }}
          />

          {editingField === 'photo' ? (
            <div style={{ marginTop: 16 }}>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button
                  onClick={() => saveField('photo')}
                  disabled={!newPhoto || loading}
                  style={{
                    padding: '10px 20px',
                    background: newPhoto ? '#28a745' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: newPhoto && !loading ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 14
                  }}
                >
                  <Save size={18} />
                  {loading ? 'Uploading...' : 'Save Photo'}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 14
                  }}
                >
                  <X size={18} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => startEdit('photo')}
              style={{
                marginTop: 16,
                padding: '10px 20px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14
              }}
            >
              <Camera size={18} />
              Change Photo
            </button>
          )}
        </div>
      </div>

      {/* Basic Information */}
      <h5 style={{ marginTop: 24, marginBottom: 12, fontSize: 16, fontWeight: 600, color: '#dc3545' }}>Basic Information</h5>
      {renderField('Full Name', 'name', user.name)}
      {renderField('Email', 'email', user.email, 'email')}
      {renderField('Phone', 'phone', user.phone, 'tel')}
      
      <div style={{ 
        marginBottom: 16, 
        padding: 12, 
        border: '2px solid #dc3545', 
        borderRadius: 8,
        backgroundColor: '#fff5f5'
      }}>
        <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4, fontWeight: 500 }}>
          Role
        </label>
        <div style={{ fontSize: 14, color: '#333' }}>
          <span style={{ 
            padding: '6px 16px', 
            background: '#dc3545', 
            color: 'white', 
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.5px'
          }}>
            🛡️ ADMINISTRATOR
          </span>
        </div>
      </div>

      {/* Address Information */}
      <h5 style={{ marginTop: 24, marginBottom: 12, fontSize: 16, fontWeight: 600, color: '#dc3545' }}>Address Information</h5>
      {renderField('Address Line 1', 'addressLine1', user.addressLine1)}
      {renderField('Address Line 2', 'addressLine2', user.addressLine2)}
      {renderField('City', 'city', user.city)}
      {renderField('State', 'state', user.state)}
      {renderField('Postal Code', 'postalCode', user.postalCode)}
      {renderField('Country', 'country', user.country)}

      {/* Password Change */}
      <h5 style={{ marginTop: 24, marginBottom: 12, fontSize: 16, fontWeight: 600, color: '#dc3545' }}>Security</h5>
      {renderField('Password', 'password', '••••••••', 'password')}

      {/* Account Info */}
      <h5 style={{ marginTop: 24, marginBottom: 12, fontSize: 16, fontWeight: 600, color: '#dc3545' }}>Admin Account Details</h5>
      <div style={{ 
        padding: 16, 
        border: '2px solid #dc3545', 
        borderRadius: 8,
        backgroundColor: '#fff5f5',
        color: '#535363',
      }}>
        <p style={{ margin: '8px 0', fontSize: 14 }}>
          <strong>Account Status:</strong> {user.isActive ? '✅ Active' : '❌ Inactive'}
        </p>
        <p style={{ margin: '8px 0', fontSize: 14 }}>
          <strong>Administrator Since:</strong> {new Date(user.createdAt).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
        <p style={{ margin: '8px 0', fontSize: 14 }}>
          <strong>Last Updated:</strong> {new Date(user.updatedAt).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
        <p style={{ margin: '8px 0', fontSize: 14 }}>
          <strong>Access Level:</strong> <span style={{ color: '#dc3545', fontWeight: 600 }}>Full Administrative Access</span>
        </p>
      </div>
    </div>
  );
}