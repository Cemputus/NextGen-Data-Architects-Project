/**
 * Main Layout Component with Navigation
 * Role-based navigation menu
 */
import React from 'react';
import {
  Box,
  Flex,
  HStack,
  VStack,
  Text,
  Button,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Avatar,
  Badge,
  useColorModeValue,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
} from '@chakra-ui/react';
import { FaBars, FaUser, FaSignOutAlt, FaCog, FaHome } from 'react-icons/fa';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rbac } from '../utils/rbac';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const bg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const getRoleColor = (role) => {
    const colors = {
      senate: 'purple',
      sysadmin: 'red',
      analyst: 'blue',
      student: 'green',
      staff: 'orange',
      dean: 'teal',
      hod: 'cyan',
      hr: 'pink',
      finance: 'yellow',
    };
    return colors[role] || 'gray';
  };

  const getNavItems = () => {
    if (!user) return [];
    const role = user.role;
    
    const navItems = {
      student: [
        { path: '/student/dashboard', label: 'My Dashboard', icon: FaHome },
        { path: '/student/grades', label: 'My Grades', icon: FaHome },
        { path: '/student/attendance', label: 'My Attendance', icon: FaHome },
        { path: '/student/payments', label: 'My Payments', icon: FaHome },
        { path: '/student/predictions', label: 'Predictions', icon: FaHome },
        { path: '/student/profile', label: 'My Profile', icon: FaUser },
      ],
      staff: [
        { path: '/staff/dashboard', label: 'Dashboard', icon: FaHome },
        { path: '/staff/classes', label: 'My Classes', icon: FaHome },
        { path: '/staff/analytics', label: 'Class Analytics', icon: FaHome },
        { path: '/staff/predictions', label: 'Predictions', icon: FaHome },
        { path: '/staff/profile', label: 'Profile', icon: FaUser },
      ],
      hod: [
        { path: '/hod/dashboard', label: 'Department Dashboard', icon: FaHome },
        { path: '/hod/analytics', label: 'Department Analytics', icon: FaHome },
        { path: '/hod/fex', label: 'FEX Analysis', icon: FaHome },
        { path: '/hod/high-school', label: 'High School Analysis', icon: FaHome },
        { path: '/hod/profile', label: 'Profile', icon: FaUser },
      ],
      dean: [
        { path: '/dean/dashboard', label: 'Faculty Dashboard', icon: FaHome },
        { path: '/dean/analytics', label: 'Faculty Analytics', icon: FaHome },
        { path: '/dean/fex', label: 'FEX Analysis', icon: FaHome },
        { path: '/dean/high-school', label: 'High School Analysis', icon: FaHome },
        { path: '/dean/profile', label: 'Profile', icon: FaUser },
      ],
      senate: [
        { path: '/senate/dashboard', label: 'Institution Dashboard', icon: FaHome },
        { path: '/senate/analytics', label: 'Analytics', icon: FaHome },
        { path: '/senate/fex', label: 'FEX Analysis', icon: FaHome },
        { path: '/senate/high-school', label: 'High School Analysis', icon: FaHome },
        { path: '/senate/predictions', label: 'Predictions', icon: FaHome },
        { path: '/senate/reports', label: 'Reports', icon: FaHome },
        { path: '/senate/profile', label: 'Profile', icon: FaUser },
      ],
      analyst: [
        { path: '/analyst/dashboard', label: 'Analyst Workspace', icon: FaHome },
        { path: '/analyst/analytics', label: 'Create Analytics', icon: FaHome },
        { path: '/analyst/fex', label: 'FEX Analysis', icon: FaHome },
        { path: '/analyst/high-school', label: 'High School Analysis', icon: FaHome },
        { path: '/analyst/predictions', label: 'Predictions', icon: FaHome },
        { path: '/analyst/reports', label: 'Reports', icon: FaHome },
        { path: '/analyst/profile', label: 'Profile', icon: FaUser },
      ],
      sysadmin: [
        { path: '/admin/dashboard', label: 'Admin Console', icon: FaHome },
        { path: '/admin/users', label: 'User Management', icon: FaHome },
        { path: '/admin/settings', label: 'System Settings', icon: FaHome },
        { path: '/admin/etl', label: 'ETL Jobs', icon: FaHome },
        { path: '/admin/audit', label: 'Audit Logs', icon: FaHome },
        { path: '/admin/profile', label: 'Profile', icon: FaUser },
      ],
      hr: [
        { path: '/hr/dashboard', label: 'HR Dashboard', icon: FaHome },
        { path: '/hr/analytics', label: 'HR Analytics', icon: FaHome },
        { path: '/hr/staff', label: 'Staff Management', icon: FaHome },
        { path: '/hr/profile', label: 'Profile', icon: FaUser },
      ],
      finance: [
        { path: '/finance/dashboard', label: 'Finance Dashboard', icon: FaHome },
        { path: '/finance/analytics', label: 'Finance Analytics', icon: FaHome },
        { path: '/finance/payments', label: 'Payments', icon: FaHome },
        { path: '/finance/profile', label: 'Profile', icon: FaUser },
      ],
    };

    return navItems[role] || [];
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Flex minH="100vh" bg="#F5F7FA">
      {/* Sidebar */}
      <Box
        w={{ base: 0, md: 250 }}
        bg={bg}
        borderRight="1px"
        borderColor={borderColor}
        display={{ base: 'none', md: 'block' }}
      >
        <VStack align="stretch" p={4} spacing={4}>
          <Box>
            <Text fontSize="xl" fontWeight="bold" color="blue.600">
              UCU Analytics
            </Text>
            <Badge colorScheme={getRoleColor(user?.role)}>{user?.role}</Badge>
          </Box>
          
          <VStack align="stretch" spacing={2}>
            {getNavItems().map((item) => (
              <Button
                key={item.path}
                leftIcon={<item.icon />}
                variant={location.pathname === item.path ? 'solid' : 'ghost'}
                colorScheme={location.pathname === item.path ? 'blue' : 'gray'}
                justifyContent="flex-start"
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </Button>
            ))}
          </VStack>
        </VStack>
      </Box>

      {/* Main Content */}
      <Flex flex={1} direction="column">
        {/* Top Bar */}
        <Box
          bg={bg}
          borderBottom="1px"
          borderColor={borderColor}
          px={6}
          py={4}
        >
          <Flex justify="space-between" align="center">
            <HStack>
              <IconButton
                icon={<FaBars />}
                onClick={onOpen}
                display={{ base: 'block', md: 'none' }}
                aria-label="Menu"
              />
              <Text fontSize="lg" fontWeight="semibold">
                {getNavItems().find(item => item.path === location.pathname)?.label || 'Dashboard'}
              </Text>
            </HStack>

            <HStack spacing={4}>
              <Text fontSize="sm" color="gray.600">
                {user?.first_name} {user?.last_name}
              </Text>
              <Menu>
                <MenuButton as={Button} variant="ghost" size="sm">
                  <Avatar size="sm" name={`${user?.first_name} ${user?.last_name}`} />
                </MenuButton>
                <MenuList>
                  <MenuItem icon={<FaUser />} onClick={() => navigate(`/${user?.role}/profile`)}>
                    Profile
                  </MenuItem>
                  <MenuItem icon={<FaCog />}>Settings</MenuItem>
                  <MenuItem icon={<FaSignOutAlt />} onClick={handleLogout}>
                    Logout
                  </MenuItem>
                </MenuList>
              </Menu>
            </HStack>
          </Flex>
        </Box>

        {/* Page Content */}
        <Box flex={1} p={6}>
          {children}
        </Box>
      </Flex>

      {/* Mobile Drawer */}
      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader>UCU Analytics</DrawerHeader>
          <DrawerBody>
            <VStack align="stretch" spacing={2}>
              {getNavItems().map((item) => (
                <Button
                  key={item.path}
                  leftIcon={<item.icon />}
                  variant={location.pathname === item.path ? 'solid' : 'ghost'}
                  justifyContent="flex-start"
                  onClick={() => {
                    navigate(item.path);
                    onClose();
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Flex>
  );
};

export default Layout;

