import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AttendeeLayout from '../../components/attendee/AttendeeLayout';
import PhotoUpload from '../../components/attendee/PhotoUpload';
import api from '../../api/client';
import { 
  CheckCircleIcon, 
  ArrowRightIcon, 
  ArrowLeftIcon,
  UserIcon,
  CalendarIcon,
  MapPinIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

const AttendeeConfirmationPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [ticketData, setTicketData] = useState(null);
  
  // Form data
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    photo: null,
    agreeToTerms: false
  });

  const steps = [
    { id: 1, title: 'Personal Information', icon: UserIcon },
    { id: 2, title: 'Photo Upload', icon: ShieldCheckIcon },
    { id: 3, title: 'Review & Submit', icon: CheckCircleIcon }
  ];

  useEffect(() => {
    if (token) {
      loadTicketData(token);
    }
  }, [token]);

  const loadTicketData = async (confirmationToken) => {
    try {
      setLoading(true);
      setError(null);

      const { data } = await api.get(`/attendees/confirm/${confirmationToken}`, { skipAuthRedirect: true });
      const attendee = data?.data?.attendee;
      const event = attendee?.event;

      setTicketData({ attendee, event });

      setFormData(prev => ({
        ...prev,
        fullName: attendee?.fullName || '',
        email: attendee?.email || '',
        phone: attendee?.phone || '',
        photo: attendee?.photo ? { preview: attendee.photo } : null
      }));
    } catch (err) {
      console.error('Error loading ticket data:', err);
      setError(err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePhotoChange = (photoData) => {
    setFormData(prev => ({
      ...prev,
      photo: photoData
    }));
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.fullName.trim()) {
          setError('Please enter your full name');
          return false;
        }
        if (!formData.email.trim()) {
          setError('Please enter your email address');
          return false;
        }
        if (!formData.phone.trim()) {
          setError('Please enter your phone number');
          return false;
        }
        break;
      case 2:
        if (!formData.photo && ticketData?.event?.requirePhotoVerification) {
          setError('Photo upload is required for this event');
          return false;
        }
        break;
      case 3:
        if (!formData.agreeToTerms) {
          setError('Please agree to the terms and conditions');
          return false;
        }
        break;
      default:
        return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setError(null);
      if (currentStep < steps.length) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    try {
      setSubmitting(true);
      setError(null);

      const submitData = new FormData();
      submitData.append('fullName', formData.fullName);
      submitData.append('email', formData.email);
      submitData.append('phone', formData.phone);
      
      if (formData.photo?.file) {
        submitData.append('photo', formData.photo.file);
      }
      
      submitData.append('agreeToTerms', formData.agreeToTerms);

      await api.post(`/attendees/confirm/${token}`, submitData, { skipAuthRedirect: true });

      navigate('/attendee/tickets', { 
        state: { message: 'Confirmation submitted successfully!' }
      });
    } catch (err) {
      console.error('Error submitting confirmation:', err);
      setError(err?.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'Time TBD';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <AttendeeLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
        </div>
      </AttendeeLayout>
    );
  }

  if (error && !ticketData) {
    return (
      <AttendeeLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Confirmation Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </AttendeeLayout>
    );
  }

  return (
    <AttendeeLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Complete Confirmation</h1>
          <p className="text-gray-600">
            Please complete the following steps to activate your ticket
          </p>
        </div>

        {/* Event Information */}
        {ticketData && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-8">
            <h2 className="text-lg font-semibold text-teal-900 mb-3">Event Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-teal-700">Event</p>
                <p className="font-medium text-teal-900">{ticketData.event?.name}</p>
              </div>
              <div>
                <p className="text-sm text-teal-700">Ticket Number</p>
                <p className="font-medium text-teal-900">{ticketData.ticketNumber}</p>
              </div>
              <div>
                <p className="text-sm text-teal-700">Date</p>
                <p className="font-medium text-teal-900">
                  {formatDate(ticketData.event?.startDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-teal-700">Time</p>
                <p className="font-medium text-teal-900">
                  {formatTime(ticketData.event?.startDate)}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-teal-700">Venue</p>
                <p className="font-medium text-teal-900">
                  {ticketData.event?.venue?.name || 'Venue TBD'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                    ${isActive 
                      ? 'border-teal-600 bg-teal-600 text-white' 
                      : isCompleted 
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-gray-300 bg-white text-gray-500'
                    }
                  `}>
                    {isCompleted ? (
                      <CheckCircleSolid className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${
                      isActive ? 'text-teal-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 ${
                      isCompleted ? 'bg-green-600' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Form Content */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Enter your full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="your.email@example.com"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Photo Upload */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Photo Verification</h2>
              
              <PhotoUpload
                currentPhoto={formData.photo?.preview}
                onPhotoChange={handlePhotoChange}
                required={ticketData?.event?.requirePhotoVerification}
                label="Profile Photo"
                helperText={
                  ticketData?.event?.requirePhotoVerification
                    ? "A clear photo is required for this event. Please upload a recent photo showing your face clearly."
                    : "Optional: Upload a photo for faster verification at the event entrance."
                }
              />
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Review & Submit</h2>
              
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-md font-medium text-gray-900 mb-4">Review Your Information</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Full Name:</span>
                    <span className="text-sm font-medium text-gray-900">{formData.fullName}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Email:</span>
                    <span className="text-sm font-medium text-gray-900">{formData.email}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Phone:</span>
                    <span className="text-sm font-medium text-gray-900">{formData.phone}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Photo:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formData.photo ? 'Uploaded' : 'Not uploaded'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    name="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                  />
                  <span className="text-sm text-gray-700">
                    I agree to the terms and conditions and confirm that all provided information is accurate
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span>Previous</span>
            </button>

            {currentStep < steps.length ? (
              <button
                onClick={handleNext}
                className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                <span>Next</span>
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-4 w-4" />
                    <span>Submit Confirmation</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </AttendeeLayout>
  );
};

export default AttendeeConfirmationPage;
