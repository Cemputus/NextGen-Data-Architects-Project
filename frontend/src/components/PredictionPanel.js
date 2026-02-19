import React, { useState } from 'react';
import axios from 'axios';
import {
  Card,
  CardBody,
  Heading,
  Text,
  Input,
  Button,
  VStack,
  HStack,
  Alert,
  AlertIcon,
  Box,
  List,
  ListItem,
  ListIcon,
  Icon,
  Badge,
} from '@chakra-ui/react';
import { FaBrain, FaUser, FaCheckCircle, FaClock, FaBook, FaMoneyBillWave, FaChartLine } from 'react-icons/fa';

const PredictionPanel = () => {
  const [studentId, setStudentId] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePredict = async () => {
    if (!studentId.trim()) {
      setError('Please enter a student ID');
      return;
    }

    setLoading(true);
    setError('');
    setPrediction(null);

    try {
      const response = await axios.post('/api/dashboard/predict-performance', {
        student_id: studentId
      });
      setPrediction(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to predict performance');
    } finally {
      setLoading(false);
    }
  };

  const getGradeColor = (grade) => {
    if (grade >= 80) return 'green.500';
    if (grade >= 70) return 'blue.500';
    if (grade >= 60) return 'yellow.500';
    return 'red.500';
  };

  const getGradeBadge = (grade) => {
    if (grade >= 80) return { color: 'green', label: 'Excellent' };
    if (grade >= 70) return { color: 'blue', label: 'Good' };
    if (grade >= 60) return { color: 'yellow', label: 'Average' };
    return { color: 'red', label: 'Needs Improvement' };
  };

  return (
    <Card boxShadow="lg" borderRadius="xl" mb={8}>
      <CardBody p={8}>
        <VStack spacing={6} align="stretch">
          <HStack spacing={3}>
            <Icon as={FaBrain} boxSize={6} color="blue.600" />
            <Heading size="lg" color="blue.600">
              Student Performance Predictor
            </Heading>
          </HStack>
          
          <Text color="gray.600" fontSize="md">
            Predict student performance based on attendance and tuition payment history using machine learning
          </Text>
          
          <HStack spacing={4}>
            <Input
              type="text"
              placeholder="Enter Student ID (e.g., STU000001)"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handlePredict()}
              size="lg"
              focusBorderColor="blue.500"
              flex={1}
            />
            <Button
              colorScheme="blue"
              size="lg"
              onClick={handlePredict}
              isLoading={loading}
              loadingText="Predicting..."
              leftIcon={<FaBrain />}
            >
              Predict Performance
            </Button>
          </HStack>

          {error && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              {error}
            </Alert>
          )}

          {prediction && (
            <Box
              bgGradient="linear(to-br, blue.50, blue.100)"
              p={6}
              borderRadius="xl"
              borderWidth="2px"
              borderColor="blue.200"
            >
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between" align="center">
                  <HStack spacing={2}>
                    <Icon as={FaUser} color="blue.600" />
                    <Text fontWeight="bold" color="blue.700">
                      Student ID: {prediction.student_id}
                    </Text>
                  </HStack>
                  <Badge
                    colorScheme={getGradeBadge(prediction.predicted_grade).color}
                    fontSize="md"
                    px={3}
                    py={1}
                    borderRadius="full"
                  >
                    {getGradeBadge(prediction.predicted_grade).label}
                  </Badge>
                </HStack>
                
                <Box textAlign="center" py={4}>
                  <Text
                    fontSize="5xl"
                    fontWeight="bold"
                    color={getGradeColor(prediction.predicted_grade)}
                    mb={2}
                  >
                    {prediction.predicted_grade}%
                  </Text>
                  <Text fontSize="md" color="gray.600" fontWeight="medium">
                    Predicted Average Grade
                  </Text>
                </Box>

                <Box bg="white" p={4} borderRadius="md">
                  <Text fontWeight="bold" mb={3} color="gray.700">
                    This prediction is based on:
                  </Text>
                  <List spacing={2}>
                    <ListItem>
                      <ListIcon as={FaClock} color="blue.500" />
                      Total attendance hours
                    </ListItem>
                    <ListItem>
                      <ListIcon as={FaCheckCircle} color="blue.500" />
                      Number of days present
                    </ListItem>
                    <ListItem>
                      <ListIcon as={FaBook} color="blue.500" />
                      Courses attended
                    </ListItem>
                    <ListItem>
                      <ListIcon as={FaMoneyBillWave} color="blue.500" />
                      Total tuition payments
                    </ListItem>
                    <ListItem>
                      <ListIcon as={FaChartLine} color="blue.500" />
                      Payment frequency and average payment amount
                    </ListItem>
                  </List>
                </Box>
              </VStack>
            </Box>
          )}
        </VStack>
      </CardBody>
    </Card>
  );
};

export default PredictionPanel;




