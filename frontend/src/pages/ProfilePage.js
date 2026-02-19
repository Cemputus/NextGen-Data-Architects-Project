/**
 * Profile Management Page
 * All users can view and edit their profile
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  VStack,
  HStack,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Button,
  Card,
  CardBody,
  Avatar,
  Text,
  Alert,
  AlertIcon,
  useToast,
} from '@chakra-ui/react';
import { FaUser, FaSave } from 'react-icons/fa';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const ProfilePage = () => {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.put('/api/auth/profile', profile, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setUser(response.data.user);
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || 'Failed to update profile',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxW="container.md" py={8}>
      <VStack spacing={6} align="stretch">
        <Heading size="xl" color="blue.600">My Profile</Heading>
        
        <Card>
          <CardBody>
            <VStack spacing={6}>
              <Avatar size="xl" name={`${user?.first_name} ${user?.last_name}`} />
              
              <Box w="100%">
                <Text fontSize="sm" color="gray.600" mb={2}>Access Number / Username</Text>
                <Text fontWeight="semibold">{user?.access_number || user?.username}</Text>
              </Box>
              
              {user?.reg_number && (
                <Box w="100%">
                  <Text fontSize="sm" color="gray.600" mb={2}>Registration Number</Text>
                  <Text fontWeight="semibold">{user?.reg_number}</Text>
                </Box>
              )}
              
              <Box w="100%">
                <Text fontSize="sm" color="gray.600" mb={2}>Role</Text>
                <Text fontWeight="semibold" textTransform="capitalize">{user?.role}</Text>
              </Box>
              
              <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                <VStack spacing={4}>
                  <FormControl>
                    <FormLabel>First Name</FormLabel>
                    <Input
                      value={profile.first_name}
                      onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                    />
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Last Name</FormLabel>
                    <Input
                      value={profile.last_name}
                      onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                    />
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Email</FormLabel>
                    <Input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    />
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>Phone</FormLabel>
                    <Input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </FormControl>
                  
                  <Button
                    type="submit"
                    leftIcon={<FaSave />}
                    colorScheme="blue"
                    isLoading={loading}
                    loadingText="Saving..."
                    w="full"
                  >
                    Save Changes
                  </Button>
                </VStack>
              </form>
            </VStack>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  );
};

export default ProfilePage;


