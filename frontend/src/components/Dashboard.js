import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Heading,
  HStack,
  VStack,
  Button,
  Text,
  Spinner,
  Center,
  Icon,
  Flex,
} from '@chakra-ui/react';
import { FaSignOutAlt, FaFileDownload, FaGraduationCap, FaUser } from 'react-icons/fa';
import axios from 'axios';
import StatsCards from './StatsCards';
import Charts from './Charts';
import PredictionPanel from './PredictionPanel';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState({});

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, deptRes, gradesRes, paymentRes, attendanceRes, gradeDistRes, topStudentsRes] = 
        await Promise.all([
          axios.get('/api/dashboard/stats'),
          axios.get('/api/dashboard/students-by-department'),
          axios.get('/api/dashboard/grades-over-time'),
          axios.get('/api/dashboard/payment-status'),
          axios.get('/api/dashboard/attendance-by-course'),
          axios.get('/api/dashboard/grade-distribution'),
          axios.get('/api/dashboard/top-students')
        ]);

      setStats(statsRes.data);
      setChartData({
        departments: deptRes.data,
        gradesOverTime: gradesRes.data,
        paymentStatus: paymentRes.data,
        attendance: attendanceRes.data,
        gradeDistribution: gradeDistRes.data,
        topStudents: topStudentsRes.data
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await axios.post('/api/report/generate', {}, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `nextgen_report_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      // If API endpoint doesn't support blob, generate client-side
      window.open('http://localhost:5000/api/report/generate', '_blank');
    }
  };

  if (loading) {
    return (
      <Box minH="100vh" bg="gray.50">
        <Center minH="100vh">
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" thickness="4px" />
            <Text color="gray.600">Loading dashboard...</Text>
          </VStack>
        </Center>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="#F5F7FA">
      {/* Header */}
      <Box bg="white" boxShadow="sm" borderBottom="1px" borderColor="gray.200">
        <Container maxW="container.xl" py={4}>
          <Flex justify="space-between" align="center" flexWrap="wrap" gap={4}>
            <HStack spacing={3}>
              <Icon as={FaGraduationCap} boxSize={8} color="blue.600" />
              <VStack align="flex-start" spacing={0}>
                <Heading size="lg" color="blue.600">
                  UCU Analytics Dashboard
                </Heading>
                <Text fontSize="sm" color="gray.500">
                  Uganda Christian University
                </Text>
              </VStack>
            </HStack>
            
            <HStack spacing={4}>
              <HStack spacing={2} bg="blue.50" px={4} py={2} borderRadius="md">
                <Icon as={FaUser} color="blue.600" />
                <Text fontWeight="medium" color="blue.700">
                  {user?.username}
                </Text>
              </HStack>
              
              <Button
                leftIcon={<FaFileDownload />}
                colorScheme="blue"
                variant="outline"
                onClick={handleDownloadPDF}
              >
                Download Report
              </Button>
              
              <Button
                leftIcon={<FaSignOutAlt />}
                colorScheme="red"
                variant="outline"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </HStack>
          </Flex>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="container.xl" py={8}>
        <StatsCards stats={stats} />
        <Charts chartData={chartData} />
        <PredictionPanel />
      </Container>
    </Box>
  );
};

export default Dashboard;




