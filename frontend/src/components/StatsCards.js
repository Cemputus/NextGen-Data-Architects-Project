import React from 'react';
import {
  SimpleGrid,
  Card,
  CardBody,
  HStack,
  VStack,
  Text,
  Icon,
  Box,
} from '@chakra-ui/react';
import {
  FaUsers,
  FaBook,
  FaClipboardList,
  FaStar,
  FaMoneyBillWave,
  FaChartLine,
} from 'react-icons/fa';

const StatsCards = ({ stats }) => {
  if (!stats) return null;

  const cards = [
    {
      title: 'Total Students',
      value: stats.total_students,
      icon: FaUsers,
      color: '#2196F3',
      bgColor: '#E3F2FD',
      borderColor: '#2196F3',
    },
    {
      title: 'Total Courses',
      value: stats.total_courses,
      icon: FaBook,
      color: '#4CAF50',
      bgColor: '#E8F5E9',
      borderColor: '#4CAF50',
    },
    {
      title: 'Total Enrollments',
      value: stats.total_enrollments,
      icon: FaClipboardList,
      color: '#FF9800',
      bgColor: '#FFF3E0',
      borderColor: '#FF9800',
    },
    {
      title: 'Average Grade',
      value: `${stats.avg_grade}%`,
      icon: FaStar,
      color: '#9C27B0',
      bgColor: '#F3E5F5',
      borderColor: '#9C27B0',
    },
    {
      title: 'Total Payments',
      value: `UGX ${(stats.total_payments / 1000000).toFixed(1)}M`,
      icon: FaMoneyBillWave,
      color: '#F44336',
      bgColor: '#FFEBEE',
      borderColor: '#F44336',
    },
    {
      title: 'Avg Attendance',
      value: `${stats.avg_attendance.toFixed(1)} hrs`,
      icon: FaChartLine,
      color: '#00BCD4',
      bgColor: '#E0F7FA',
      borderColor: '#00BCD4',
    },
  ];

  return (
    <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={4} mb={8}>
      {cards.map((card, index) => (
        <Card
          key={index}
          boxShadow="sm"
          borderRadius="md"
          borderLeft="4px solid"
          borderLeftColor={card.borderColor}
          bg="white"
          _hover={{
            transform: 'translateY(-2px)',
            boxShadow: 'md',
            transition: 'all 0.2s',
          }}
          transition="all 0.2s"
        >
          <CardBody p={4}>
            <VStack spacing={2} align="stretch">
              <HStack justify="space-between" align="flex-start">
                <Box
                  bg={card.bgColor}
                  p={2}
                  borderRadius="md"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon as={card.icon} boxSize={4} color={card.color} />
                </Box>
              </HStack>
              <VStack align="flex-start" spacing={0}>
                <Text fontSize="xl" fontWeight="bold" color="gray.800">
                  {card.value}
                </Text>
                <Text fontSize="xs" color="gray.600" fontWeight="medium" lineHeight="1.2">
                  {card.title}
                </Text>
              </VStack>
            </VStack>
          </CardBody>
        </Card>
      ))}
    </SimpleGrid>
  );
};

export default StatsCards;




